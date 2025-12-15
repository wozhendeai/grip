import { Button } from '@/components/ui/button';
import { getSession } from '@/lib/auth-server';
import { getBountyWithAuthor } from '@/lib/db/queries/bounties';
import { getUserWallet } from '@/lib/db/queries/passkeys';
import { getSubmissionsByBounty } from '@/lib/db/queries/submissions';
import type { Bounty, SubmissionStatus } from '@/lib/types';
import Link from 'next/link';
import { BountyDetail } from './_components/bounty-detail';

interface BountyPageProps {
  params: Promise<{ owner: string; repo: string; id: string }>;
}

/**
 * Bounty detail page (public)
 *
 * Full bounty view with description, status, and actions.
 * Can also be shown as a modal via route interception.
 */
export default async function BountyPage({ params }: BountyPageProps) {
  const { owner, repo, id } = await params;

  const result = await getBountyWithAuthor(id);

  // Verify bounty exists and belongs to this repo
  if (!result || result.bounty.githubOwner !== owner || result.bounty.githubRepo !== repo) {
    return (
      <div className="container py-8 text-center">
        <h1 className="text-2xl font-bold">Bounty not found</h1>
        <p className="mt-2 text-muted-foreground">
          No bounty found with ID &quot;{id}&quot; in {owner}/{repo}
        </p>
        <Button
          render={<Link href={`/${owner}/${repo}/bounties`}>View Repo Bounties</Link>}
          className="mt-4"
        />
      </div>
    );
  }

  const { bounty: bountyData, author } = result;
  const submissionsData = await getSubmissionsByBounty(id);

  // Check if current user can approve (primary funder)
  const session = await getSession();
  const canApprove = session?.user?.id === bountyData.primaryFunderId;

  // Get funder's wallet info for payment flow
  let treasuryCredentials: { credentialId: string; address: string } | null = null;
  if (canApprove && session?.user) {
    const funderWallet = await getUserWallet(session.user.id);
    if (funderWallet?.id && funderWallet?.tempoAddress) {
      treasuryCredentials = {
        credentialId: funderWallet.id,
        address: funderWallet.tempoAddress,
      };
    }
  }

  // Transform to Bounty type (use bounty fields directly - they're denormalized)
  // BigInt fields are serialized to strings for JSON compatibility
  const bounty: Bounty = {
    id: bountyData.id,
    network: bountyData.network,
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
    <BountyDetail
      bounty={bounty}
      canApprove={canApprove}
      treasuryCredentials={treasuryCredentials}
    />
  );
}
