import { requireAuth } from '@/lib/auth-server';
import { getBountyById } from '@/lib/db/queries/bounties';
import { getUserWallet } from '@/lib/db/queries/passkeys';
import { createSubmission, getUserSubmissionForBounty } from '@/lib/db/queries/submissions';
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
