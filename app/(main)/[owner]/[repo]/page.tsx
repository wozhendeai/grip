import { BountyCard } from '@/components/bounty/bounty-card';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription } from '@/components/ui/empty';
import { getSession } from '@/lib/auth-server';
import { getBountiesByGithubRepoId } from '@/lib/db/queries/bounties';
import { getRepoSettingsByName } from '@/lib/db/queries/repo-settings';
import { fetchGitHubRepo } from '@/lib/github/repo';
import type { Bounty, BountyProject } from '@/lib/types';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProjectHeader } from './_components/project-header';

interface ProjectPageProps {
  params: Promise<{ owner: string; repo: string }>;
}

/**
 * Project overview page (public) - PERMISSIONLESS
 *
 * Works for ANY public GitHub repository, whether or not it's been "claimed".
 * Fetches from GitHub API first, then overlays BountyLane data if available.
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
      <ProjectHeader
        project={project}
        github={githubRepo}
        isClaimed={!!repoSettings}
        openBounties={openBounties}
        completedBounties={completedBounties}
        totalFunded={totalFunded}
        isLoggedIn={!!session?.user}
      />

      {/* Recent Bounties */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent Bounties</h2>
          {bounties.length > 3 && (
            <Button
              render={<Link href={`/${owner}/${repo}/bounties`}>View All</Link>}
              variant="outline"
            />
          )}
        </div>

        {recentBounties.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recentBounties.map((bounty) => (
              <BountyCard key={bounty.id} bounty={bounty} />
            ))}
          </div>
        ) : (
          <Empty>
            <EmptyDescription>
              No bounties yet on this repository.
              {!repoSettings && ' Anyone can create a bounty!'}
            </EmptyDescription>
          </Empty>
        )}
      </div>

      {/* Settings/Claim link moved to footer (was prominent button in header)
          Settings is optional - only needed for advanced features:
          - Webhook auto-install (PR merge detection)
          - Bounty restrictions and auto-approval settings
          - Team member permissions
          Most users create permissionless bounties without claiming
          Trade-off: Less visibility for advanced feature, cleaner header
          See: Plan misty-pondering-cascade.md */}
      {session?.user && (canManage || !repoSettings) && (
        <div className="mt-12 border-t border-border pt-8 text-center">
          <p className="text-sm text-muted-foreground">
            {!repoSettings ? (
              <>
                Maintainer?{' '}
                <Link href={`/${owner}/${repo}/settings`} className="text-primary hover:underline">
                  Claim this repo
                </Link>{' '}
                to enable webhooks and auto-approval.
              </>
            ) : (
              <>
                <Link href={`/${owner}/${repo}/settings`} className="text-primary hover:underline">
                  Project settings
                </Link>{' '}
                · Manage webhooks, treasury, and permissions
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
