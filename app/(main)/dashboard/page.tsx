import { getSession } from '@/lib/auth/auth-server';
import {
  getAllBounties,
  getBountiesCreatedByUser,
  getCompletedBountiesByUser,
  getUserActiveRepos,
  getUserActiveSubmissions,
  getUserOnboardingStatus,
} from '@/db/queries/bounties';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { ActivityFeed } from './_components/activity-feed';
import { QuickActions } from './_components/quick-actions';
import { Suggestions } from './_components/suggestions';
import { Onboarding } from './_components/onboarding';
import { ActiveRepos } from './_components/active-repos';
import type { Bounty } from '@/lib/types';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Your command center on GRIP.',
};

export default async function DashboardPage() {
  const session = await getSession();

  if (!session?.user) {
    redirect('/login');
  }

  const userId = session.user.id;

  // Parallel data fetching
  const [
    onboardingStatus,
    activeRepos,
    createdBounties,
    activeSubmissions,
    completedBounties,
    // Fetch some generic bounties for suggestions fallback
    genericSuggestions,
  ] = await Promise.all([
    getUserOnboardingStatus(userId),
    getUserActiveRepos(userId, 5),
    getBountiesCreatedByUser(userId, { limit: 5 }),
    getUserActiveSubmissions(userId, { limit: 5 }),
    getCompletedBountiesByUser(userId, { limit: 5 }),
    getAllBounties({ limit: 3, status: 'open', sort: 'amount' }),
  ]);

  // Transform generic suggestions to Bounty type
  const suggestedBounties: Bounty[] = genericSuggestions.map(({ bounty }) => ({
    ...bounty,
    id: bounty.id,
    chainId: bounty.chainId,
    githubRepoId: bounty.githubRepoId.toString(),
    githubOwner: bounty.githubOwner,
    githubRepo: bounty.githubRepo,
    githubFullName: bounty.githubFullName,
    githubIssueNumber: bounty.githubIssueNumber,
    githubIssueId: bounty.githubIssueId.toString(),
    githubIssueAuthorId: bounty.githubIssueAuthorId?.toString() ?? null,
    githubIssueUrl: `https://github.com/${bounty.githubFullName}/issues/${bounty.githubIssueNumber}`,
    title: bounty.title,
    body: bounty.body,
    labels: bounty.labels,
    totalFunded: bounty.totalFunded.toString(),
    tokenAddress: bounty.tokenAddress,
    primaryFunderId: bounty.primaryFunderId,
    status: bounty.status as Bounty['status'],
    approvedAt: bounty.approvedAt,
    ownerApprovedAt: bounty.ownerApprovedAt,
    paidAt: bounty.paidAt,
    cancelledAt: bounty.cancelledAt,
    createdAt: bounty.createdAt,
    updatedAt: bounty.updatedAt,
    project: {
      githubOwner: bounty.githubOwner,
      githubRepo: bounty.githubRepo,
      githubFullName: bounty.githubFullName,
    },
  }));

  // TODO: Ideally we would fetch personalized suggestions based on activeRepos here
  // For now, we use generic high-value bounties

  return (
    <main className="min-h-screen bg-background pb-12">
      {/* Header */}
      <div className="border-b border-border pb-8 pt-10">
        <div className="container">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {session.user.name?.split(' ')[0] ?? 'Contributor'}.
          </p>
        </div>
      </div>

      <div className="container py-8 grid gap-6 grid-cols-1 lg:grid-cols-4">
        {/* Row 1: Onboarding/Active (3/4) & Quick Actions (1/4) */}
        <div className="lg:col-span-3 h-full">
          {onboardingStatus.allComplete || (await cookies()).get('grip-onboarding-skipped') ? (
            <ActiveRepos repos={activeRepos} />
          ) : (
            <Onboarding status={onboardingStatus} />
          )}
        </div>

        <div className="lg:col-span-1 h-full">
          <QuickActions />
        </div>

        {/* Row 2: Activity Feed (1/2) & Suggestions (1/2) */}
        {/* Note: In a 4-col grid, 1/2 width is 2 cols */}
        <div className="lg:col-span-2 h-full">
          <ActivityFeed
            created={createdBounties}
            claimed={activeSubmissions}
            completed={completedBounties}
          />
        </div>

        <div className="lg:col-span-2 h-full">
          <Suggestions
            bounties={suggestedBounties}
            title="Suggestions"
            subtitle={activeRepos.length > 0 ? 'Based on your activity' : 'Popular bounties'}
          />
        </div>
      </div>
    </main>
  );
}
