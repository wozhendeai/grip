import { BountyCard } from '@/components/bounty/bounty-card';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { getBountiesByGithubRepoId } from '@/db/queries/bounties';
import { getRepoSettingsByName } from '@/db/queries/repo-settings';
import { getSession } from '@/lib/auth/auth-server';
import type { Bounty } from '@/lib/types';
import Link from 'next/link';

interface BountiesPageProps {
  params: Promise<{ owner: string; repo: string }>;
}

/**
 * Project bounties list page (public)
 *
 * Shows all bounties for a specific project.
 */
export default async function BountiesPage({ params }: BountiesPageProps) {
  const { owner, repo } = await params;
  const [repoSettings, session] = await Promise.all([
    getRepoSettingsByName(owner, repo),
    getSession(),
  ]);

  if (!repoSettings) {
    return (
      <div className="container py-8 text-center">
        <h1 className="text-2xl font-bold">Repository not found</h1>
        <p className="mt-2 text-muted-foreground">
          No repo settings found for {owner}/{repo}
        </p>
        <Button nativeButton={false} render={<Link href="/explore" />} className="mt-4">
          Browse Bounties
        </Button>
      </div>
    );
  }

  const bountiesData = await getBountiesByGithubRepoId(repoSettings.githubRepoId);

  // Determine if user can see amounts:
  // - Amounts are public, OR
  // - User is the repo owner, OR
  // - User is a funder on the bounty (checked per-bounty below)
  const userId = session?.user?.id ?? null;
  const isRepoOwner = userId === repoSettings.verifiedOwnerUserId;
  const showAmounts = repoSettings.showAmountsPublicly || isRepoOwner;

  // Transform to Bounty type (use bounty fields directly - they're denormalized)
  // BigInt fields are serialized to strings for JSON compatibility
  const bounties: Bounty[] = bountiesData.map((b) => {
    // Check if user is a funder on this bounty (allows seeing amount even when hidden)
    const isFunder = userId === b.primaryFunderId;
    const canSeeAmount = showAmounts || isFunder;

    return {
      id: b.id,
      chainId: b.chainId,
      githubRepoId: b.githubRepoId.toString(),
      githubOwner: b.githubOwner,
      githubRepo: b.githubRepo,
      githubFullName: b.githubFullName,
      githubIssueNumber: b.githubIssueNumber,
      githubIssueId: b.githubIssueId.toString(),
      githubIssueAuthorId: b.githubIssueAuthorId?.toString() ?? null,
      githubIssueUrl: `https://github.com/${b.githubFullName}/issues/${b.githubIssueNumber}`,
      title: b.title,
      body: b.body,
      labels: b.labels,
      totalFunded: canSeeAmount ? b.totalFunded.toString() : null,
      tokenAddress: b.tokenAddress,
      primaryFunderId: b.primaryFunderId,
      status: b.status as Bounty['status'],
      approvedAt: b.approvedAt,
      ownerApprovedAt: b.ownerApprovedAt,
      paidAt: b.paidAt,
      cancelledAt: b.cancelledAt,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      project: {
        githubOwner: b.githubOwner,
        githubRepo: b.githubRepo,
        githubFullName: b.githubFullName,
      },
      author: undefined,
      submissions: undefined,
    };
  });

  const openCount = bounties.filter((b) => b.status === 'open').length;

  return (
    <div className="container py-8">
      {/* Breadcrumb */}
      <div className="mb-4 text-sm text-muted-foreground">
        <Link href={`/${owner}/${repo}`} className="hover:text-foreground">
          {owner}/{repo}
        </Link>
        <span className="mx-2">/</span>
        <span>Bounties</span>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">
          Bounties for {owner}/{repo}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {bounties.length} bounties · {openCount} open
        </p>
      </div>

      {/* Bounty Grid */}
      {bounties.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No bounties yet</EmptyTitle>
            <EmptyDescription>There are no bounties for this repository yet.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bounties.map((bounty, index) => (
            <BountyCard key={bounty.id} bounty={bounty} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}
