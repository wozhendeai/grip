import { getSession } from '@/lib/auth/auth-server';
import { getUserActiveRepos, getUserActiveSubmissions, getUserOnboardingStatus } from '@/db/queries/bounties';
import { getDashboardStats, getUserActivityFeed } from '@/db/queries/dashboard';
import { getUserOrganizations } from '@/db/queries/users';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { StatsRow } from './_components/stats-row';
import { RepositoriesCard } from './_components/repositories-card';
import { OrganizationsCard } from './_components/organizations-card';
import { ActiveWorkCard } from './_components/active-work-card';
import { ActivityFeed } from './_components/activity-feed';
import { ExploreCTA } from './_components/explore-cta';
import { Onboarding } from './_components/onboarding';

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
  const [onboardingStatus, dashboardStats, activeRepos, userOrgs, activeSubmissions, activityFeed] =
    await Promise.all([
      getUserOnboardingStatus(userId),
      getDashboardStats(userId),
      getUserActiveRepos(userId, 5),
      getUserOrganizations(userId, userId),
      getUserActiveSubmissions(userId, { limit: 5 }),
      getUserActivityFeed(userId, 10),
    ]);

  // Check if onboarding should be shown
  const cookieStore = await cookies();
  const showOnboarding = !onboardingStatus.allComplete && !cookieStore.get('grip-onboarding-skipped');

  return (
    <main className="min-h-screen bg-background pb-12">
      {/* Header */}
      <div className="border-b border-border pb-8 pt-10">
        <div className="container">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {session.user.name?.split(' ')[0] ?? 'Contributor'}.
          </p>
        </div>
      </div>

      <div className="container py-8">
        {/* Stats Row */}
        <div className="mb-8">
          <StatsRow stats={dashboardStats} />
        </div>

        {/* Three Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_280px] xl:grid-cols-[220px_1fr_280px] gap-6 lg:gap-8 items-start">
          {/* Left Column: Navigation / Context */}
          <div className="space-y-6 lg:sticky lg:top-4">
            <RepositoriesCard repos={activeRepos} />
            <OrganizationsCard organizations={userOrgs} />
          </div>

          {/* Middle Column: Feed / Active Work */}
          <div className="space-y-8 min-w-0">
            <ActiveWorkCard submissions={activeSubmissions} />
            <ActivityFeed activities={activityFeed} />
          </div>

          {/* Right Column: Onboarding or Explore */}
          <div className="space-y-6">
            {showOnboarding ? (
              <Onboarding status={onboardingStatus} />
            ) : (
              <ExploreCTA />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
