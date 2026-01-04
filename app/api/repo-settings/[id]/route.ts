import { getBountiesByGithubRepoId } from '@/db/queries/bounties';
import {
  getRepoSettingsByGithubRepoId,
  isUserRepoOwner,
  updateRepoSettings,
  type RepoSettingsUpdate,
} from '@/db/queries/repo-settings';
import { getSession } from '@/lib/auth/auth-server';
import { type NextRequest, NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const githubRepoId = Number.parseInt(id);

    if (Number.isNaN(githubRepoId)) {
      return NextResponse.json({ error: 'Invalid repo ID' }, { status: 400 });
    }

    const repoSettings = await getRepoSettingsByGithubRepoId(BigInt(githubRepoId));

    if (!repoSettings) {
      return NextResponse.json({ error: 'Repo settings not found' }, { status: 404 });
    }

    const bounties = await getBountiesByGithubRepoId(BigInt(githubRepoId));

    // Define type for bounty
    type Bounty = {
      id: string;
      status: string;
      totalFunded: bigint;
      title: string;
      tokenAddress: string;
      githubIssueNumber: number;
      createdAt: string | null;
    };

    // Compute stats from bounties (not cached)
    const totalFunded = bounties
      .filter((b: Bounty) => b.status === 'open')
      .reduce((sum: bigint, b: Bounty) => sum + b.totalFunded, BigInt(0));
    const totalPaid = bounties
      .filter((b: Bounty) => b.status === 'completed')
      .reduce((sum: bigint, b: Bounty) => sum + b.totalFunded, BigInt(0));
    const bountiesCreated = bounties.length;
    const bountiesCompleted = bounties.filter((b: Bounty) => b.status === 'completed').length;

    return NextResponse.json({
      repoSettings: {
        ...repoSettings,
        githubRepoId: repoSettings.githubRepoId.toString(),
        installationId: repoSettings.installationId?.toString() ?? null,
      },
      bounties: bounties.map((bounty: Bounty) => ({
        id: bounty.id,
        title: bounty.title,
        totalFunded: bounty.totalFunded.toString(),
        tokenAddress: bounty.tokenAddress,
        status: bounty.status,
        githubIssueNumber: bounty.githubIssueNumber,
        createdAt: bounty.createdAt,
      })),
      stats: {
        totalFunded: totalFunded.toString(),
        totalPaid: totalPaid.toString(),
        bountiesCreated,
        bountiesCompleted,
      },
    });
  } catch (error) {
    console.error('Error fetching repo settings:', error);
    return NextResponse.json({ error: 'Failed to fetch repo settings' }, { status: 500 });
  }
}

/**
 * PATCH /api/repo-settings/[id]
 *
 * Update repo settings. Only the verified repo owner can update settings.
 *
 * Body:
 * - autoPayEnabled?: boolean - Toggle auto-pay on PR merge
 *
 * Returns:
 * - success: { success: true, repoSettings: {...} }
 * - error: { error: string }
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await context.params;
    const githubRepoId = Number.parseInt(id);

    if (Number.isNaN(githubRepoId)) {
      return NextResponse.json({ error: 'Invalid repo ID' }, { status: 400 });
    }

    // Verify user is the repo owner
    const isOwner = await isUserRepoOwner(BigInt(githubRepoId), session.user.id);
    if (!isOwner) {
      return NextResponse.json(
        { error: 'Only the repo owner can update settings' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Build updates object from valid fields
    const updates: RepoSettingsUpdate = {};

    if (typeof body.autoPayEnabled === 'boolean') {
      updates.autoPayEnabled = body.autoPayEnabled;
    }
    if (typeof body.requireOwnerApproval === 'boolean') {
      updates.requireOwnerApproval = body.requireOwnerApproval;
    }
    if (body.defaultExpirationDays === null || typeof body.defaultExpirationDays === 'number') {
      updates.defaultExpirationDays = body.defaultExpirationDays;
    }
    if (
      body.contributorEligibility === 'anyone' ||
      body.contributorEligibility === 'collaborators'
    ) {
      updates.contributorEligibility = body.contributorEligibility;
    }
    if (typeof body.showAmountsPublicly === 'boolean') {
      updates.showAmountsPublicly = body.showAmountsPublicly;
    }
    if (typeof body.emailOnSubmission === 'boolean') {
      updates.emailOnSubmission = body.emailOnSubmission;
      // TODO: sendEmail(...) - Wire up to email service when implemented
    }
    if (typeof body.emailOnMerge === 'boolean') {
      updates.emailOnMerge = body.emailOnMerge;
      // TODO: sendEmail(...) - Wire up to email service when implemented
    }
    if (typeof body.emailOnPaymentFailure === 'boolean') {
      updates.emailOnPaymentFailure = body.emailOnPaymentFailure;
      // TODO: sendEmail(...) - Wire up to email service when implemented
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const updated = await updateRepoSettings(BigInt(githubRepoId), updates);

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      repoSettings: {
        ...updated,
        githubRepoId: updated.githubRepoId.toString(),
        installationId: updated.installationId?.toString() ?? null,
      },
    });
  } catch (error) {
    console.error('Error updating repo settings:', error);
    return NextResponse.json({ error: 'Failed to update repo settings' }, { status: 500 });
  }
}
