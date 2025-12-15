import { requireAuth } from '@/lib/auth-server';
import { getBountyWithOptionalRepoSettings, isUserPrimaryFunder } from '@/lib/db/queries/bounties';
import { isUserRepoOwner } from '@/lib/db/queries/repo-settings';
import {
  addLabelToIssue,
  commentOnIssue,
  generateBountyComment,
  getGitHubToken,
} from '@/lib/github/issues';
import { notifyBountyCreatedOnRepo } from '@/lib/notifications';
import { type NextRequest, NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/bounties/[id]/publish
 *
 * Add GitHub label and comment to an existing bounty.
 * In new schema, bounties are created with 'open' status by default.
 * This endpoint is for retroactively publishing to GitHub.
 *
 * Returns:
 * - bounty: The bounty
 * - message: Success message
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;

    // Get bounty with optional repo settings
    const result = await getBountyWithOptionalRepoSettings(id);
    if (!result) {
      return NextResponse.json({ error: 'Bounty not found' }, { status: 404 });
    }

    const { bounty, repoSettings } = result;

    // Check user has permission (primary funder OR repo owner)
    const isPrimaryFunder = await isUserPrimaryFunder(bounty.id, session.user.id);
    const isRepoOwner = repoSettings
      ? await isUserRepoOwner(repoSettings.githubRepoId, session.user.id)
      : false;

    if (!isPrimaryFunder && !isRepoOwner) {
      return NextResponse.json(
        { error: 'You do not have permission to publish this bounty' },
        { status: 403 }
      );
    }

    // Bounties are already 'open' in new schema
    if (bounty.status !== 'open') {
      return NextResponse.json(
        {
          error: `Cannot publish bounty in '${bounty.status}' status.`,
        },
        { status: 400 }
      );
    }

    // Get GitHub token
    const token = await getGitHubToken(session.user.id);
    if (!token) {
      return NextResponse.json(
        { error: 'GitHub account not connected. Please sign in with GitHub.' },
        { status: 400 }
      );
    }

    // Add bounty label to GitHub issue
    await addLabelToIssue(token, bounty.githubOwner, bounty.githubRepo, bounty.githubIssueNumber);

    // Post comment on the issue
    const bountyUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://bountylane.xyz'}/${bounty.githubOwner}/${bounty.githubRepo}/bounties/${bounty.id}`;
    const commentBody = generateBountyComment({
      amount: bounty.totalFunded.toString(),
      tokenSymbol: 'USDC',
      claimDeadlineDays: 14,
      bountyUrl,
    });
    await commentOnIssue(
      token,
      bounty.githubOwner,
      bounty.githubRepo,
      bounty.githubIssueNumber,
      commentBody
    );

    // Notify repo owner about new bounty (if they exist and aren't the funder)
    if (repoSettings?.verifiedOwnerUserId && repoSettings.verifiedOwnerUserId !== session.user.id) {
      try {
        await notifyBountyCreatedOnRepo({
          ownerId: repoSettings.verifiedOwnerUserId,
          bountyId: bounty.id,
          bountyTitle: bounty.title,
          amount: bounty.totalFunded.toString(),
          tokenAddress: bounty.tokenAddress,
          repoFullName: bounty.githubFullName,
          repoOwner: bounty.githubOwner,
          repoName: bounty.githubRepo,
        });
      } catch (error) {
        console.error('[publish] Failed to create bounty created notification:', error);
      }
    }

    return NextResponse.json({
      bounty,
      message: 'Bounty published to GitHub successfully.',
      githubIssueUrl: `https://github.com/${bounty.githubFullName}/issues/${bounty.githubIssueNumber}`,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error publishing bounty:', error);
    return NextResponse.json(
      {
        error: 'Failed to publish bounty',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
