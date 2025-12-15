import { requireAuth } from '@/lib/auth-server';
import { getBountiesByGithubRepoId } from '@/lib/db/queries/bounties';
import { getGitHubToken, listOpenIssues } from '@/lib/github/issues';
import { type NextRequest, NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/repo-settings/[id]/issues
 *
 * List open GitHub issues for a repo that don't already have bounties.
 * Used by the bounty creation form to show available issues.
 * Permissionless: anyone can view issues for any public repo.
 *
 * Returns:
 * - issues: Array of GitHub issues available for bounty creation
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;
    const githubRepoId = Number.parseInt(id);

    if (Number.isNaN(githubRepoId)) {
      return NextResponse.json({ error: 'Invalid repo ID' }, { status: 400 });
    }

    // Get GitHub token for the authenticated user
    const token = await getGitHubToken(session.user.id);
    if (!token) {
      return NextResponse.json(
        { error: 'GitHub account not connected. Please sign in with GitHub.' },
        { status: 400 }
      );
    }

    // Fetch GitHub repo to get owner/name
    const githubRepo = await fetch(`https://api.github.com/repositories/${githubRepoId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());

    if (!githubRepo || !githubRepo.owner || !githubRepo.name) {
      return NextResponse.json({ error: 'Could not fetch GitHub repo info' }, { status: 500 });
    }

    const githubOwner = githubRepo.owner.login;
    const githubRepoName = githubRepo.name;

    // Fetch open issues from GitHub
    const result = await listOpenIssues(token, githubOwner, githubRepoName);
    const githubIssues = result.issues;

    // Get existing bounties for this repo to filter out issues that already have bounties
    const existingBountiesData = await getBountiesByGithubRepoId(BigInt(githubRepoId));
    const issuesWithBounties = new Set(
      existingBountiesData.map((bounty: { githubIssueNumber: number }) => bounty.githubIssueNumber)
    );

    // Filter out issues that already have bounties
    const availableIssues = githubIssues
      .filter((issue) => !issuesWithBounties.has(issue.number))
      .map((issue) => ({
        id: issue.id,
        number: issue.number,
        title: issue.title,
        body: issue.body,
        htmlUrl: issue.html_url,
        labels: issue.labels.map((l: { name: string; color: string }) => ({
          name: l.name,
          color: l.color,
        })),
        user: {
          login: issue.user.login,
          avatarUrl: issue.user.avatar_url,
        },
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        hasBounty: false,
      }));

    // Also include issues that already have bounties (marked as unavailable)
    const unavailableIssues = githubIssues
      .filter((issue) => issuesWithBounties.has(issue.number))
      .map((issue) => ({
        id: issue.id,
        number: issue.number,
        title: issue.title,
        body: issue.body,
        htmlUrl: issue.html_url,
        labels: issue.labels.map((l: { name: string; color: string }) => ({
          name: l.name,
          color: l.color,
        })),
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
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching issues:', error);
    return NextResponse.json({ error: 'Failed to fetch issues' }, { status: 500 });
  }
}
