import { RepoOnboardingModal } from './_components/onboarding';
import { getRepoBountiesWithSubmissions } from '@/db/queries/bounties';
import { getUserOnboardingInfo } from '@/db/queries/passkeys';
import { getRepoSettingsByName } from '@/db/queries/repo-settings';
import { getSession } from '@/lib/auth/auth-server';
import { fetchGitHubRepo } from '@/lib/github';
import type { Bounty, BountyProject, SubmissionStatus } from '@/lib/types';
import { notFound } from 'next/navigation';
import { BountyList } from './_components/bounty-list';
import { RepoHeader } from './_components/repo-header';

interface ProjectPageProps {
  params: Promise<{ owner: string; repo: string }>;
  searchParams: Promise<{ onboarding?: string }>;
}

/**
 * Project overview page (public) - PERMISSIONLESS
 *
 * Works for ANY public GitHub repository, whether or not it's been "claimed".
 * Fetches from GitHub API first, then overlays GRIP data if available.
 */
export default async function ProjectPage({ params, searchParams }: ProjectPageProps) {
  const { owner, repo } = await params;
  const { onboarding } = await searchParams;

  // 1. Fetch from GitHub (works for ANY public repo)
  const githubRepo = await fetchGitHubRepo(owner, repo);

  if (!githubRepo) {
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

  // 3. Get bounties for this repo (with submissions for "Claimed" status)
  const bountiesData = await getRepoBountiesWithSubmissions(BigInt(githubRepo.id));

  // Build project info (minimal - just repo identifiers)
  const project: BountyProject = {
    githubOwner: githubRepo.owner.login,
    githubRepo: githubRepo.name,
    githubFullName: githubRepo.full_name,
  };

  // Transform bounties data
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
    // Map submissions needed for "Claimed" status
    submissions: b.submissions.map((s) => ({
      id: s.id,
      userId: s.userId,
      githubUserId: s.githubUserId?.toString() ?? null,
      githubPrId: s.githubPrId?.toString() ?? null,
      githubPrNumber: s.githubPrNumber,
      githubPrUrl: s.githubPrUrl,
      githubPrTitle: s.githubPrTitle,
      status: s.status as SubmissionStatus,
      funderApprovedAt: s.funderApprovedAt,
      funderApprovedBy: s.funderApprovedBy,
      ownerApprovedAt: s.ownerApprovedAt,
      ownerApprovedBy: s.ownerApprovedBy,
      rejectedAt: s.rejectedAt,
      rejectedBy: s.rejectedBy,
      rejectionNote: s.rejectionNote,
      prMergedAt: s.prMergedAt,
      prClosedAt: s.prClosedAt,
      submittedAt: s.submittedAt,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      submitter: { id: s.userId, name: null, image: null, hasWallet: false }, // Placeholder as we didn't join user
    })),
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
    .reduce((sum, b) => sum + (b.totalFunded ? BigInt(b.totalFunded) : BigInt(0)), BigInt(0))
    .toString();

  // Check if current user can manage the repo settings
  const session = await getSession();
  const canManage = repoSettings && session?.user?.id === repoSettings.verifiedOwnerUserId;

  // Check if we should show the onboarding modal
  const isVerifiedOwner = repoSettings?.verifiedOwnerUserId === session?.user?.id;
  const showOnboarding =
    isVerifiedOwner &&
    (onboarding === 'true' || (repoSettings && !repoSettings.onboardingCompleted));

  // Fetch user wallet info for onboarding modal
  const userOnboardingInfo =
    showOnboarding && session?.user?.id ? await getUserOnboardingInfo(session.user.id) : null;

  return (
    <>
      {/* Onboarding modal for newly claimed repos */}
      {showOnboarding && repoSettings && userOnboardingInfo && (
        <RepoOnboardingModal
          repo={{
            owner,
            name: repo,
            githubRepoId: repoSettings.githubRepoId.toString(),
          }}
          user={userOnboardingInfo}
        />
      )}

      <div className="min-h-screen bg-background">
        <div className="container max-w-5xl mx-auto px-4 sm:px-6">
          {/* Header */}
          <RepoHeader
            github={githubRepo}
            owner={owner}
            repo={repo}
            stats={{
              totalFunded,
              openBounties,
              completedBounties,
            }}
            isClaimed={!!repoSettings}
            canManage={!!canManage}
            isLoggedIn={!!session?.user}
          />

          <div className="mt-8">
            {/* Main Content: Bounty List (Full Width) */}
            <BountyList bounties={bounties} isClaimed={!!repoSettings} owner={owner} repo={repo} />
          </div>
        </div>
      </div>
    </>
  );
}
