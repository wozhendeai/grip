import { RouteModal } from '@/components/layout/route-modal';
import { getBountyWithAuthor } from '@/db/queries/bounties';
import { getSubmissionsByBounty } from '@/db/queries/submissions';
import type { Bounty, SubmissionStatus } from '@/lib/types';
import { BountyDetail } from '../../../../../[owner]/[repo]/bounties/[id]/_components/bounty-detail';

interface BountyModalPageProps {
  params: Promise<{ owner: string; repo: string; id: string }>;
}

/**
 * Bounty detail modal (intercepted route)
 *
 * Shows bounty details in a modal when navigating within the app.
 * Direct URL access shows the full page instead.
 */
export default async function BountyModalPage({ params }: BountyModalPageProps) {
  const { owner, repo, id } = await params;
  const result = await getBountyWithAuthor(id);

  // Verify bounty exists and belongs to this repo
  if (!result || result.bounty.githubOwner !== owner || result.bounty.githubRepo !== repo) {
    return (
      <RouteModal title="Bounty not found" useBack>
        <div className="p-6 text-center">
          <h2 className="text-lg font-medium">Bounty not found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            No bounty found with ID &quot;{id}&quot;
          </p>
        </div>
      </RouteModal>
    );
  }

  const { bounty: bountyData, author } = result;
  const submissionsData = await getSubmissionsByBounty(id);

  // Transform to Bounty type (use bounty fields directly - they're denormalized)
  // BigInt fields are serialized to strings for JSON compatibility
  const bounty: Bounty = {
    id: bountyData.id,
    chainId: bountyData.chainId,
    githubRepoId: bountyData.githubRepoId.toString(),
    githubOwner: bountyData.githubOwner,
    githubRepo: bountyData.githubRepo,
    githubFullName: bountyData.githubFullName,
    githubIssueNumber: bountyData.githubIssueNumber,
    githubIssueId: bountyData.githubIssueId.toString(),
    githubIssueAuthorId: bountyData.githubIssueAuthorId?.toString() ?? null,
    githubIssueUrl: `https://github.com/${bountyData.githubFullName}/issues/${bountyData.githubIssueNumber}`,
    title: bountyData.title,
    body: bountyData.body,
    labels: bountyData.labels,
    totalFunded: bountyData.totalFunded.toString(),
    tokenAddress: bountyData.tokenAddress,
    primaryFunderId: bountyData.primaryFunderId,
    status: bountyData.status as Bounty['status'],
    approvedAt: bountyData.approvedAt,
    ownerApprovedAt: bountyData.ownerApprovedAt,
    paidAt: bountyData.paidAt,
    cancelledAt: bountyData.cancelledAt,
    createdAt: bountyData.createdAt,
    updatedAt: bountyData.updatedAt,
    project: {
      githubOwner: bountyData.githubOwner,
      githubRepo: bountyData.githubRepo,
      githubFullName: bountyData.githubFullName,
    },
    author: author
      ? {
          id: author.id,
          name: author.name,
          image: author.image,
        }
      : undefined,
    submissions: submissionsData.map((s) => ({
      ...s.submission,
      githubUserId: s.submission.githubUserId?.toString() ?? null,
      githubPrId: s.submission.githubPrId?.toString() ?? null,
      status: s.submission.status as SubmissionStatus,
      submitter: s.submitter,
    })),
  };

  return (
    <RouteModal title={bounty.title} useBack>
      <BountyDetail bounty={bounty} />
    </RouteModal>
  );
}
