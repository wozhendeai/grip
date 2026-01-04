import { getBountyById } from '@/db/queries/bounties';
import { getUserWallet } from '@/db/queries/passkeys';
import { getRepoSettingsByGithubRepoId } from '@/db/queries/repo-settings';
import { createSubmission, getUserSubmissionForBounty } from '@/db/queries/submissions';
import { requireAuth } from '@/lib/auth/auth-server';
import { isUserCollaborator } from '@/lib/github/api';
import { type NextRequest, NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/bounties/[id]/submit
 *
 * Submit work (PR) for a bounty.
 * Multiple users can submit on same bounty (race condition model).
 * First merged PR wins.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;
    const body = await request.json();

    const { githubPrNumber, githubPrUrl, githubPrTitle, githubPrId, githubUserId } = body;

    // Progressive wallet requirement: Check user has a wallet to receive payment
    const wallet = await getUserWallet(session.user.id);
    if (!wallet?.tempoAddress) {
      return NextResponse.json(
        { error: 'WALLET_REQUIRED', message: 'Create a wallet to submit work for bounties' },
        { status: 400 }
      );
    }

    const bounty = await getBountyById(id);
    if (!bounty) {
      return NextResponse.json({ error: 'Bounty not found' }, { status: 404 });
    }

    // Check bounty is open
    if (bounty.status !== 'open') {
      return NextResponse.json({ error: 'Bounty is not accepting submissions' }, { status: 400 });
    }

    // Check contributor eligibility if repo has settings
    const repoSettings = await getRepoSettingsByGithubRepoId(bounty.githubRepoId);
    if (repoSettings?.contributorEligibility === 'collaborators') {
      const githubUsername = session.user.name;
      if (!githubUsername) {
        return NextResponse.json(
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
        return NextResponse.json(
          {
            error: 'COLLABORATOR_REQUIRED',
            message: 'This repository only accepts submissions from collaborators',
          },
          { status: 403 }
        );
      }
    }

    // Validate PR fields
    if (!githubPrNumber || !githubPrUrl) {
      return NextResponse.json(
        { error: 'githubPrNumber and githubPrUrl are required' },
        { status: 400 }
      );
    }

    // Check user doesn't already have a submission for this bounty
    const existingSubmission = await getUserSubmissionForBounty(id, session.user.id);
    if (existingSubmission) {
      return NextResponse.json(
        { error: 'You already have a submission on this bounty' },
        { status: 400 }
      );
    }

    // Create submission (race condition model: multiple submissions allowed)
    const submission = await createSubmission({
      bountyId: id,
      userId: session.user.id,
      githubUserId,
      githubPrId,
      githubPrNumber,
      githubPrUrl,
      githubPrTitle,
    });

    return NextResponse.json({
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
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error submitting work:', error);
    return NextResponse.json({ error: 'Failed to submit work' }, { status: 500 });
  }
}
