import { getSubmissionsByUser } from '@/db/queries/submissions';
import { requireAuth } from '@/lib/auth/auth-server';
import { handleRouteError } from '@/app/api/_lib';

/**
 * GET /api/submissions
 *
 * Fetch all bounty submissions for the authenticated user.
 * Includes submission status, PR details, and associated bounty info.
 */
export async function GET() {
  try {
    const session = await requireAuth();
    const submissionsData = await getSubmissionsByUser(session.user.id);

    const submissions = submissionsData.map(({ submission, bounty }) => ({
      id: submission.id,
      status: submission.status,
      githubPrNumber: submission.githubPrNumber,
      githubPrUrl: submission.githubPrUrl,
      githubPrTitle: submission.githubPrTitle,
      submittedAt: submission.submittedAt,
      funderApprovedAt: submission.funderApprovedAt,
      ownerApprovedAt: submission.ownerApprovedAt,
      rejectedAt: submission.rejectedAt,
      rejectionNote: submission.rejectionNote,
      prMergedAt: submission.prMergedAt,
      bounty: {
        id: bounty.id,
        title: bounty.title,
        amount: bounty.totalFunded,
        tokenAddress: bounty.tokenAddress,
        status: bounty.status,
        githubIssueNumber: bounty.githubIssueNumber,
        githubIssueUrl: `https://github.com/${bounty.githubFullName}/issues/${bounty.githubIssueNumber}`,
      },
      project: {
        githubOwner: bounty.githubOwner,
        githubRepo: bounty.githubRepo,
        githubFullName: bounty.githubFullName,
      },
    }));

    return Response.json({ submissions });
  } catch (error) {
    return handleRouteError(error, 'fetching submissions');
  }
}
