import { getRepoSettingsByGithubRepoId, markOnboardingComplete } from '@/db/queries/repo-settings';
import { getSession } from '@/lib/auth/auth-server';
import { type NextRequest, NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/repo-settings/[id]/onboarding
 *
 * Mark onboarding as complete for a repo.
 * Only the verified owner can mark onboarding complete.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const githubRepoId = Number.parseInt(id);

    if (Number.isNaN(githubRepoId)) {
      return NextResponse.json({ error: 'Invalid repo ID' }, { status: 400 });
    }

    const repoSettings = await getRepoSettingsByGithubRepoId(BigInt(githubRepoId));
    if (!repoSettings) {
      return NextResponse.json({ error: 'Repo settings not found' }, { status: 404 });
    }

    // Only the verified owner can mark onboarding complete
    if (repoSettings.verifiedOwnerUserId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await markOnboardingComplete(BigInt(githubRepoId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[onboarding] Failed to mark complete:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
