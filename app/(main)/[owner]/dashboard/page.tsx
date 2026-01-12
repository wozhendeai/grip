import { getSession } from '@/lib/auth/auth-server';
import { getOrgBySlug, isOrgMember, getOrgMembersWithUsers } from '@/db/queries/organizations';
import {
  getOrgDashboardStats,
  getOrgActiveBounties,
  getOrgActivityFeed,
  getOrgSpendingData,
  getOrgDashboardRepos,
} from '@/db/queries/org-dashboard';
import { getOrganization } from '@/lib/github';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { OrgDashboardHeader } from './_components/org-dashboard-header';
import { OrgStatsRow } from './_components/org-stats-row';
import { OrgSpendingCard } from './_components/org-spending-card';
import { OrgBountiesList } from './_components/org-bounties-list';
import { OrgActivityFeed } from './_components/org-activity-feed';
import { OrgQuickActions } from './_components/org-quick-actions';
import { OrgReposNav } from './_components/org-repos-nav';
import { OrgTeamNav } from './_components/org-team-nav';

interface OrgDashboardPageProps {
  params: Promise<{ owner: string }>;
}

export async function generateMetadata({ params }: OrgDashboardPageProps): Promise<Metadata> {
  const { owner } = await params;
  return {
    title: `${owner} Dashboard`,
    description: `Organization dashboard for ${owner}`,
  };
}

/**
 * Organization Dashboard Page
 *
 * Members-only dashboard showing org stats, spending, bounties, and activity.
 * Non-members are redirected to the public org profile.
 */
export default async function OrgDashboardPage({ params }: OrgDashboardPageProps) {
  const { owner } = await params;
  const session = await getSession();

  // Must be logged in
  if (!session?.user) {
    redirect('/login');
  }

  // Resolve org by slug
  const org = await getOrgBySlug(owner);
  if (!org) {
    // Not a BountyLane org - redirect to profile page (may be GitHub org)
    redirect(`/${owner}`);
  }

  // Must be a member to access dashboard
  const isMember = await isOrgMember(org.id, session.user.id);
  if (!isMember) {
    // Non-members see the public profile
    redirect(`/${owner}`);
  }

  // Fetch all dashboard data in parallel
  const [stats, bounties, activity, spending, repos, members, github] = await Promise.all([
    getOrgDashboardStats(org.id),
    getOrgActiveBounties(org.id, 5),
    getOrgActivityFeed(org.id, 5),
    getOrgSpendingData(org.id),
    getOrgDashboardRepos(org.id, 5),
    getOrgMembersWithUsers(org.id),
    org.githubOrgLogin ? getOrganization(org.githubOrgLogin) : null,
  ]);

  return (
    <main className="min-h-screen bg-background pb-12">
      {/* Header */}
      <div className="border-b border-border">
        <div className="container max-w-[1400px] py-8">
          <OrgDashboardHeader
            org={org}
            github={github}
            memberCount={stats.memberCount}
            repos={repos}
          />

          {/* Stats Row */}
          <div className="mt-6">
            <OrgStatsRow stats={stats} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container max-w-[1400px] py-8">
        {/* 3-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] xl:grid-cols-[220px_1fr_280px] gap-6 lg:gap-8 items-start">
          {/* Left Column: Navigation */}
          <div className="space-y-6 lg:sticky lg:top-4">
            <OrgReposNav repos={repos} orgSlug={org.slug} />
            <OrgTeamNav members={members} />
          </div>

          {/* Middle Column: Main Content */}
          <div className="space-y-8 min-w-0">
            <OrgSpendingCard spending={spending} orgSlug={org.slug} />
            <OrgBountiesList bounties={bounties} orgSlug={org.slug} />
          </div>

          {/* Right Column: Activity & Actions */}
          <div className="space-y-6">
            <OrgActivityFeed activities={activity} />
            <OrgQuickActions orgSlug={org.slug} />
          </div>
        </div>
      </div>
    </main>
  );
}
