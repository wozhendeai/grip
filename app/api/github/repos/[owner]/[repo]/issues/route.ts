import { requireAuth } from '@/lib/auth-server';
import { getBountiesByGithubRepoId } from '@/lib/db/queries/bounties';
import {
  type GitHubIssue,
  type IssuesResult,
  getGitHubToken,
  listOpenIssues,
  searchRepoIssues,
} from '@/lib/github/issues';
import { fetchGitHubRepo } from '@/lib/github/repo';
import { type NextRequest, NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ owner: string; repo: string }>;
};

/**
 * GET /api/github/repos/[owner]/[repo]/issues
 *
 * Fetch open GitHub issues for ANY public repository (claimed or unclaimed).
 * Uses the user's GitHub OAuth token to fetch issues.
 * Filters out issues that already have bounties.
 *
 * This enables permissionless bounty creation - anyone can create bounties on any public repo.
 *
 * Returns:
 * - issues: Array of GitHub issues available for bounty creation
 * - unavailableIssues: Array of issues that already have bounties
 * - total: Total number of open issues
 * - available: Number of issues available for bounty creation
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    // 1. Require authentication
    const session = await requireAuth();
    const { owner, repo } = await context.params;

    // Get page and search params from query string
    const searchParams = request.nextUrl.searchParams;
    const page = Number.parseInt(searchParams.get('page') ?? '1', 10);
    const searchTerm = searchParams.get('search') ?? '';

    // 2. Get user's GitHub token
    const token = await getGitHubToken(session.user.id);
    if (!token) {
      return NextResponse.json(
        { error: 'GitHub account not connected. Please sign out and sign in with GitHub.' },
        { status: 400 }
      );
    }

    // 3. Fetch repository metadata to get the repo ID
    // Uses server's GitHub token (public repos don't require user token for metadata)
    const repoData = await fetchGitHubRepo(owner, repo);
    if (!repoData) {
      return NextResponse.json({ error: 'Repository not found or private' }, { status: 404 });
    }
    if (repoData.private) {
      return NextResponse.json(
        { error: 'This repository is private. Only public repositories can have bounties.' },
        { status: 404 }
      );
    }

    // 4. Fetch open issues from GitHub using user's token
    // Use search API if search term provided, otherwise use list API
    // Search API searches ALL issues in repo, list API returns paginated results
    let githubIssues: GitHubIssue[];
    let hasNextPage = false;
    try {
      let result: IssuesResult;
      if (searchTerm.trim()) {
        // Use GitHub Search API for server-side search across all issues
        result = await searchRepoIssues(token, owner, repo, searchTerm, { page });
      } else {
        // Use list endpoint for initial load / no search
        result = await listOpenIssues(token, owner, repo, { page });
      }
      githubIssues = result.issues;
      hasNextPage = result.hasNextPage;
    } catch (error) {
      // Check for GitHub rate limit
      if (error instanceof Error && error.message.includes('rate limit')) {
        return NextResponse.json(
          { error: 'GitHub rate limit exceeded. Please try again in a few minutes.' },
          { status: 403 }
        );
      }
      // Check for 404 (repo not found or private)
      if (error instanceof Error && error.message.includes('404')) {
        return NextResponse.json({ error: 'Repository not found or private' }, { status: 404 });
      }
      throw error;
    }

    // 5. Get existing bounties for this repo to filter out issues that already have bounties
    const existingBounties = await getBountiesByGithubRepoId(BigInt(repoData.id));
    const issuesWithBounties = new Set(
      existingBounties.map((b: { githubIssueNumber: number }) => b.githubIssueNumber)
    );

    // 6. Filter out issues that already have bounties
    const availableIssues = githubIssues
      .filter((issue) => !issuesWithBounties.has(issue.number))
      .map((issue) => ({
        id: issue.id,
        number: issue.number,
        title: issue.title,
        body: issue.body,
        htmlUrl: issue.html_url,
        labels: issue.labels.map((l) => ({ name: l.name, color: l.color })),
        user: {
          login: issue.user.login,
          avatarUrl: issue.user.avatar_url,
        },
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        hasBounty: false,
      }));

    // 7. Also include issues that already have bounties (marked as unavailable)
    const unavailableIssues = githubIssues
      .filter((issue) => issuesWithBounties.has(issue.number))
      .map((issue) => ({
        id: issue.id,
        number: issue.number,
        title: issue.title,
        body: issue.body,
        htmlUrl: issue.html_url,
        labels: issue.labels.map((l) => ({ name: l.name, color: l.color })),
        user: {
          login: issue.user.login,
          avatarUrl: issue.user.avatar_url,
        },
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        hasBounty: true,
      }));

    return NextResponse.json({
      issues: availableIssues,
      unavailableIssues,
      total: githubIssues.length,
      available: availableIssues.length,
      page,
      hasNextPage,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to create bounties.' },
        { status: 401 }
      );
    }
    console.error('Error fetching issues:', error);
    return NextResponse.json({ error: 'Failed to fetch issues' }, { status: 500 });
  }
}
