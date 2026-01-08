import { getBountyById } from '@/db/queries/bounties';
import { getUserWallet } from '@/db/queries/passkeys';
import { getRepoSettingsByGithubRepoId } from '@/db/queries/repo-settings';
import { createSubmission, getUserSubmissionForBounty } from '@/db/queries/submissions';
import { requireAuth } from '@/lib/auth/auth-server';
import { isUserCollaborator } from '@/lib/github/api';
import { handleRouteError, validateBody } from '@/app/api/_lib';
import { bountySubmitSchema } from '@/app/api/_lib/schemas';
import type { NextRequest } from 'next/server';

/**
 * POST /api/bounties/[id]/submit
 *
 * Submit work (PR) for a bounty.
 * Multiple users can submit on same bounty (race condition model).
 * First merged PR wins.
 */
export async function POST(request: NextRequest, ctx: RouteContext<'/api/bounties/[id]/submit'>) {
  try {
    const session = await requireAuth();
    const { id } = await ctx.params;
    const body = await validateBody(request, bountySubmitSchema);

    // Check wallet requirement
    const wallet = await getUserWallet(session.user.id);
    if (!wallet?.tempoAddress) {
      return Response.json(
        { error: 'WALLET_REQUIRED', message: 'Create a wallet to submit work for bounties' },
        { status: 400 }
      );
    }

    const bounty = await getBountyById(id);
    if (!bounty) {
      return Response.json({ error: 'Bounty not found' }, { status: 404 });
    }

    if (bounty.status !== 'open') {
      return Response.json({ error: 'Bounty is not accepting submissions' }, { status: 400 });
    }

    // Check collaborator eligibility
    const repoSettings = await getRepoSettingsByGithubRepoId(bounty.githubRepoId);
    if (repoSettings?.contributorEligibility === 'collaborators') {
      const githubUsername = session.user.name;
      if (!githubUsername) {
        return Response.json(
          { error: 'GitHub username not found. Please re-link your GitHub account.' },
          { status: 400 }
        );
      }

      const isCollaborator = await isUserCollaborator(
        bounty.githubOwner,
        bounty.githubRepo,
        githubUsername
      );
      if (!isCollaborator) {
        return Response.json(
          {
            error: 'COLLABORATOR_REQUIRED',
            message: 'This repository only accepts submissions from collaborators',
          },
          { status: 403 }
        );
      }
    }

    // Check for existing submission
    const existingSubmission = await getUserSubmissionForBounty(id, session.user.id);
    if (existingSubmission) {
      return Response.json(
        { error: 'You already have a submission on this bounty' },
        { status: 400 }
      );
    }

    const submission = await createSubmission({
      bountyId: id,
      userId: session.user.id,
      githubUserId: body.githubUserId ? BigInt(String(body.githubUserId)) : undefined,
      githubPrId: body.githubPrId ? BigInt(String(body.githubPrId)) : undefined,
      githubPrNumber: body.githubPrNumber,
      githubPrUrl: body.githubPrUrl,
      githubPrTitle: body.githubPrTitle,
    });

    return Response.json({
      message: 'Work submitted successfully',
      submission: {
        id: submission.id,
        bountyId: submission.bountyId,
        status: submission.status,
        githubPrNumber: submission.githubPrNumber,
        githubPrUrl: submission.githubPrUrl,
        submittedAt: submission.submittedAt,
      },
    });
  } catch (error) {
    return handleRouteError(error, 'submitting work');
  }
}
