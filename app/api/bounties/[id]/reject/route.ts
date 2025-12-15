import { requireAuth } from '@/lib/auth-server';
import { getBountyWithRepoSettings, updateBountyStatus } from '@/lib/db/queries/bounties';
import {
  getActiveSubmissionsForBounty,
  getSubmissionById,
  rejectSubmission,
} from '@/lib/db/queries/submissions';
import { notifyPrRejected } from '@/lib/notifications';
import { type NextRequest, NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/bounties/[id]/reject
 *
 * Reject a bounty submission. Only reopens bounty if NO other active submissions exist.
 * In the promise model, primary funder controls rejections.
 *
 * Body:
 * - submissionId: Specific submission to reject (optional, required if multiple submissions)
 * - note: Rejection reason (required)
 *
 * Returns:
 * - message: Success message
 * - bounty: Updated bounty status (if reopened)
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;

    // Parse request body
    let body: { submissionId?: string; note?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Request body is required' }, { status: 400 });
    }

    if (!body.note || body.note.trim().length === 0) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
    }

    // Get bounty with repo settings
    const result = await getBountyWithRepoSettings(id);
    if (!result) {
      return NextResponse.json({ error: 'Bounty not found' }, { status: 404 });
    }

    const { bounty } = result;

    // Permission check: primary funder controls rejections
    if (bounty.primaryFunderId !== session.user.id) {
      return NextResponse.json(
        { error: 'Only the primary funder can reject submissions' },
        { status: 403 }
      );
    }

    // Determine which submission to reject
    let submissionToReject = null;

    if (body.submissionId) {
      // Explicit submission ID provided
      submissionToReject = await getSubmissionById(body.submissionId);
      if (!submissionToReject || submissionToReject.bountyId !== id) {
        return NextResponse.json({ error: 'Invalid submission ID' }, { status: 400 });
      }
    } else {
      // Auto-detect: get single active submission (error if multiple)
      const activeSubmissions = await getActiveSubmissionsForBounty(id);
      if (activeSubmissions.length === 0) {
        return NextResponse.json({ error: 'No active submissions to reject' }, { status: 400 });
      }
      if (activeSubmissions.length === 1) {
        submissionToReject = activeSubmissions[0].submission;
      } else {
        return NextResponse.json(
          {
            error: 'Multiple active submissions. Specify submissionId in request body.',
            activeSubmissions: activeSubmissions.map((s) => ({
              id: s.submission.id,
              userId: s.submission.userId,
              submittedAt: s.submission.submittedAt,
            })),
          },
          { status: 400 }
        );
      }
    }

    if (!submissionToReject) {
      return NextResponse.json({ error: 'No submission to reject' }, { status: 400 });
    }

    // Reject the submission
    await rejectSubmission(submissionToReject.id, session.user.id, body.note);

    // Notify contributor that PR was rejected
    // Wrapped in try-catch to not block rejection flow if notification fails
    try {
      await notifyPrRejected({
        claimantId: submissionToReject.userId,
        bountyId: bounty.id,
        bountyTitle: bounty.title,
        rejectionNote: body.note,
        repoFullName: bounty.githubFullName ?? 'unknown/unknown',
        repoOwner: bounty.githubOwner ?? 'unknown',
        repoName: bounty.githubRepo ?? 'unknown',
      });
    } catch (error) {
      console.error('[reject] Failed to create PR rejected notification:', error);
    }

    // Only reopen bounty if NO other active submissions
    const remainingSubmissions = await getActiveSubmissionsForBounty(id);
    let reopened = false;

    if (remainingSubmissions.length === 0) {
      await updateBountyStatus(id, 'open');
      reopened = true;
    }

    return NextResponse.json({
      message: reopened
        ? 'Submission rejected. Bounty is now open for new submissions.'
        : 'Submission rejected. Bounty has other active submissions.',
      reopened,
      remainingSubmissionsCount: remainingSubmissions.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error rejecting bounty:', error);
    return NextResponse.json({ error: 'Failed to reject bounty' }, { status: 500 });
  }
}
