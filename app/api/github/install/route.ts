import { requireAuth } from '@/lib/auth/auth-server';
import { signClaimState, getSimpleInstallUrl } from '@/lib/github';
import { NextResponse } from 'next/server';

/**
 * POST /api/github/install
 *
 * Get the GitHub App installation URL for adding new repos.
 * Unlike /api/repos/[owner]/[repo]/claim, this doesn't target a specific repo.
 */
export async function POST() {
  try {
    const session = await requireAuth();

    // Include callbackUrl in state if not production (enables dev proxy)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const isProduction = appUrl.includes('usegrip.xyz');
    const callbackUrl = !isProduction ? `${appUrl}/api/github/callback` : undefined;

    // Generate signed state (no specific repo)
    const state = signClaimState({
      userId: session.user.id,
      owner: '',
      repo: '',
      timestamp: Date.now(),
      callbackUrl,
    });

    const installUrl = getSimpleInstallUrl(state);

    return NextResponse.json({ installUrl });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[github/install] Error:', error);
    return NextResponse.json({ error: 'Failed to get install URL' }, { status: 500 });
  }
}
