import { account, db, repoSettings } from '@/db';
import { requireAuth } from '@/lib/auth/auth-server';
import { and, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/github/repos
 *
 * Fetch the authenticated user's GitHub repositories.
 * Uses the stored OAuth access token from the account table.
 *
 * Query params:
 * - page: GitHub API page number (default: 1, each page has up to 100 repos)
 *
 * Returns repos where the user has admin access (can install webhooks).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Get page from query params
    const searchParams = request.nextUrl.searchParams;
    const page = Number.parseInt(searchParams.get('page') ?? '1', 10);

    // Get the GitHub account with access token
    const [githubAccount] = await db
      .select({
        accessToken: account.accessToken,
      })
      .from(account)
      .where(and(eq(account.userId, session.user.id), eq(account.providerId, 'github')))
      .limit(1);

    if (!githubAccount?.accessToken) {
      return NextResponse.json(
        { error: 'GitHub account not connected. Please sign in with GitHub.' },
        { status: 400 }
      );
    }

    // Get repo IDs that user has already verified
    const verifiedRepos = await db
      .select({ githubRepoId: repoSettings.githubRepoId })
      .from(repoSettings)
      .where(eq(repoSettings.verifiedOwnerUserId, session.user.id));

    const verifiedRepoIds = new Set(verifiedRepos.map((r) => BigInt(r.githubRepoId)));

    // Fetch user's repos from GitHub API (100 per page)
    const response = await fetch(
      `https://api.github.com/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner,organization_member`,
      {
        headers: {
          Authorization: `Bearer ${githubAccount.accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('GitHub API error:', error);

      if (response.status === 401) {
        return NextResponse.json(
          { error: 'GitHub token expired. Please sign out and sign in again.' },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to fetch repositories from GitHub' },
        { status: response.status }
      );
    }

    // Parse Link header for pagination info
    const linkHeader = response.headers.get('Link');
    const hasNextPage = linkHeader?.includes('rel="next"') ?? false;
    const hasPrevPage = page > 1;

    const repos = await response.json();

    // Filter to repos where user has admin permission (can install webhooks)
    // Map to simplified format with verified status
    const adminRepos = repos
      .filter((repo: GitHubRepo) => repo.permissions?.admin)
      .map((repo: GitHubRepo) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        owner: repo.owner.login,
        description: repo.description,
        language: repo.language,
        stargazersCount: repo.stargazers_count,
        forksCount: repo.forks_count,
        openIssuesCount: repo.open_issues_count,
        defaultBranch: repo.default_branch,
        private: repo.private,
        htmlUrl: repo.html_url,
        updatedAt: repo.updated_at,
        verified: verifiedRepoIds.has(BigInt(repo.id)),
      }));

    return NextResponse.json({
      repos: adminRepos,
      page,
      hasNextPage,
      hasPrevPage,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching GitHub repos:', error);
    return NextResponse.json({ error: 'Failed to fetch repositories' }, { status: 500 });
  }
}

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
  };
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  default_branch: string;
  private: boolean;
  html_url: string;
  updated_at: string;
  permissions?: {
    admin: boolean;
    push: boolean;
    pull: boolean;
  };
}
