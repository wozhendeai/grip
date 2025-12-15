import { getBountyWithAuthor, getBountyWithFunders } from '@/lib/db/queries/bounties';
import { getSubmissionsByBounty } from '@/lib/db/queries/submissions';
import { type NextRequest, NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await getBountyWithAuthor(id);

    if (!result) {
      return NextResponse.json({ error: 'Bounty not found' }, { status: 404 });
    }

    const { bounty, repoSettings, author } = result;
    const submissionsData = await getSubmissionsByBounty(id);
    const bountyWithFunders = await getBountyWithFunders(id);

    // Transform to API response format
    const response = {
      id: bounty.id,
      title: bounty.title,
      body: bounty.body,
      amount: bounty.totalFunded,
      tokenAddress: bounty.tokenAddress,
      status: bounty.status,
      labels: bounty.labels,
      githubIssueNumber: bounty.githubIssueNumber,
      githubIssueUrl: `https://github.com/${bounty.githubFullName}/issues/${bounty.githubIssueNumber}`,
      approvedAt: bounty.approvedAt,
      ownerApprovedAt: bounty.ownerApprovedAt,
      paidAt: bounty.paidAt,
      createdAt: bounty.createdAt,
      network: bounty.network,
      project: {
        githubOwner: bounty.githubOwner,
        githubRepo: bounty.githubRepo,
        githubFullName: bounty.githubFullName,
      },
      author: author
        ? {
            id: author.id,
            name: author.name,
            image: author.image,
          }
        : null,
      funders: bountyWithFunders?.funders ?? [],
      submissions: submissionsData.map(({ submission, submitter }) => ({
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
        submitter: {
          id: submitter.id,
          name: submitter.name,
          image: submitter.image,
        },
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching bounty:', error);
    return NextResponse.json({ error: 'Failed to fetch bounty' }, { status: 500 });
  }
}
