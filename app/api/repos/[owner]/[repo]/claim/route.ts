import { requireAuth } from '@/lib/auth/auth-server';
import { fetchGitHubRepo, signClaimState, getSimpleInstallUrl } from '@/lib/github';
import { type NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ owner: string; repo: string }>;
}

/**
 * POST /api/repos/[owner]/[repo]/claim
 *
 * Initiate the repo claiming flow by generating a signed state
 * and returning the GitHub App installation URL.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth();
    const { owner, repo } = await params;

    // Verify repo exists on GitHub
    const githubRepo = await fetchGitHubRepo(owner, repo);
    if (!githubRepo) {
      return NextResponse.json({ error: 'Repository not found on GitHub' }, { status: 404 });
    }

    // Only allow claiming public repos
    if (githubRepo.private) {
      return NextResponse.json({ error: 'Cannot claim private repositories' }, { status: 400 });
    }

    // Include callbackUrl in state if not production (enables dev proxy)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const productionUrl = 'https://usegrip.xyz';
    const callbackUrl = appUrl !== productionUrl ? `${appUrl}/api/github/callback` : undefined;

    // Generate signed state for the installation callback
    const state = signClaimState({
      userId: session.user.id,
      owner: githubRepo.owner.login,
      repo: githubRepo.name,
      timestamp: Date.now(),
      callbackUrl,
    });

    // Build the GitHub App installation URL
    const installUrl = getSimpleInstallUrl(state);

    return NextResponse.json({ installUrl });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[claim] Error initiating claim:', error);
    return NextResponse.json({ error: 'Failed to initiate claim' }, { status: 500 });
  }
}
