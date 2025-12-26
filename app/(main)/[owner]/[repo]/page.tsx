import { BountyCard } from '@/components/bounty/bounty-card';
import { getBountiesByGithubRepoId } from '@/db/queries/bounties';
import { getRepoSettingsByName } from '@/db/queries/repo-settings';
import { getSession } from '@/lib/auth/auth-server';
import { fetchGitHubRepo } from '@/lib/github';
import type { Bounty, BountyProject } from '@/lib/types';
import { notFound } from 'next/navigation';
import { BountiesEmptyState } from './_components/bounties-empty-state';
import { RepoInfoHeader } from './_components/repo-info-header';
import { RepoStatsCard } from './_components/repo-stats-card';

interface ProjectPageProps {
  params: Promise<{ owner: string; repo: string }>;
}

/**
 * Project overview page (public) - PERMISSIONLESS
 *
 * Works for ANY public GitHub repository, whether or not it's been "claimed".
 * Fetches from GitHub API first, then overlays GRIP data if available.
 *
 * Claiming is optional and only unlocks:
 * - Webhook auto-install (for PR merge detection)
 * - Settings access (auto-approve, payout mode)
 * - Maintainer badge on repo page
 */
export default async function ProjectPage({ params }: ProjectPageProps) {
  const { owner, repo } = await params;

  // 1. Fetch from GitHub (works for ANY public repo)
  const githubRepo = await fetchGitHubRepo(owner, repo);

  if (!githubRepo) {
    // Only 404 if GitHub repo doesn't exist
    return notFound();
  }

  if (githubRepo.private) {
    return (
      <div className="container py-8 text-center">
        <h1 className="text-2xl font-bold">Private Repository</h1>
        <p className="mt-2 text-muted-foreground">
          This repository is private and cannot be displayed.
        </p>
      </div>
    );
  }

  // 2. Check if this repo has been claimed (optional)
  const repoSettings = await getRepoSettingsByName(owner, repo);

  // 3. Get bounties for this repo (by GitHub repo ID)
  const bountiesData = await getBountiesByGithubRepoId(BigInt(githubRepo.id));

  // Build project info (minimal - just repo identifiers)
  const project: BountyProject = {
    githubOwner: githubRepo.owner.login,
    githubRepo: githubRepo.name,
    githubFullName: githubRepo.full_name,
  };

  // Transform bounties data
  // BigInt fields are serialized to strings for JSON compatibility
  const bounties: Bounty[] = bountiesData.map((b) => ({
    id: b.id,
    network: b.network,
    githubRepoId: b.githubRepoId.toString(),
    githubOwner: b.githubOwner,
    githubRepo: b.githubRepo,
    githubFullName: b.githubFullName,
    githubIssueNumber: b.githubIssueNumber,
    githubIssueId: b.githubIssueId.toString(),
    githubIssueAuthorId: b.githubIssueAuthorId?.toString() ?? null,
    githubIssueUrl: `https://github.com/${githubRepo.full_name}/issues/${b.githubIssueNumber}`,
    title: b.title,
    body: b.body,
    labels: b.labels,
    totalFunded: b.totalFunded.toString(),
    tokenAddress: b.tokenAddress,
    primaryFunderId: b.primaryFunderId,
    status: b.status as Bounty['status'],
    approvedAt: b.approvedAt,
    ownerApprovedAt: b.ownerApprovedAt,
    paidAt: b.paidAt,
    cancelledAt: b.cancelledAt,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    project,
  }));

  // Compute stats from bounties
  const openBounties = bounties.filter((b) => b.status === 'open').length;
  const completedBounties = bounties.filter((b) => b.status === 'completed').length;
  const totalFunded = bounties
    .reduce((sum, b) => sum + BigInt(b.totalFunded), BigInt(0))
    .toString(); // Convert to string for JSON serialization

  // Get recent bounties
  const recentBounties = bounties.slice(0, 3);

  // Check if current user can manage the repo settings
  const session = await getSession();
  const canManage = repoSettings && session?.user?.id === repoSettings.verifiedOwnerUserId;

  return (
    <div className="container py-8">
      <div className="mx-auto max-w-7xl">
        {/* Full width header section */}
        <RepoInfoHeader github={githubRepo} isClaimed={!!repoSettings} />

        {/* Full width heading */}
        <h2 className="mt-8 mb-4 text-xl font-semibold">Recent Bounties</h2>

        {/* Two-column layout for bounties + stats */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Column - Bounties */}
          <div className="flex-1">
            {recentBounties.length > 0 ? (
              <div className="space-y-4">
                {recentBounties.map((bounty) => (
                  <BountyCard key={bounty.id} bounty={bounty} />
                ))}
              </div>
            ) : (
              <BountiesEmptyState isClaimed={!!repoSettings} />
            )}
          </div>

          {/* Right Column - Sticky Stats */}
          <aside className="lg:w-80 lg:sticky lg:top-8 lg:self-start">
            <RepoStatsCard
              owner={owner}
              repo={repo}
              totalFunded={totalFunded}
              openBounties={openBounties}
              completedBounties={completedBounties}
              isClaimed={!!repoSettings}
              canManage={!!canManage}
              isLoggedIn={!!session?.user}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
