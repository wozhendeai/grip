import { requireAuth } from '@/lib/auth-server';
import { getSubmissionsByUser } from '@/lib/db/queries/submissions';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const session = await requireAuth();
    const submissionsData = await getSubmissionsByUser(session.user.id);

    const submissions = submissionsData.map(({ submission, bounty, repoSettings }) => ({
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

    return NextResponse.json({ submissions });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching user submissions:', error);
    return NextResponse.json({ error: 'Failed to fetch submissions' }, { status: 500 });
  }
}
