'use client';

import { useState, useMemo } from 'react';
import type { GitHubOrganizationMinimal } from '@/lib/github';
import type { organization } from '@/db/schema/auth';
import { OrgHeader } from './org-header';
import { OrgToolbar, type OrgTab } from './org-toolbar';
import { OrgBountiesList, type OrgBountyItem } from './org-bounties-list';
import { OrgRepos } from './org-repos';
import { OrgActivity } from './org-activity';
import type { ActivityItem } from './activity-feed';

interface OrgRepo {
  id: bigint;
  owner: string;
  name: string;
  description?: string | null;
  language?: string | null;
  languageColor?: string | null;
  bountyCount: number;
  totalFunded: bigint;
}

interface OrgBounty {
  id: string;
  title: string;
  amount: bigint;
  status: 'open' | 'completed' | 'cancelled';
  githubOwner: string;
  githubRepo: string;
  githubIssueNumber: number;
  createdAt: string | null;
}

interface OrgProfileProps {
  github: GitHubOrganizationMinimal;
  repos: OrgRepo[];
  gripOrg: typeof organization.$inferSelect | null;
  bountyData: {
    funded: OrgBounty[];
    totalFunded: bigint;
    fundedCount: number;
  } | null;
  members: Array<{
    id: string;
    role: string;
    user: {
      id: string;
      name: string;
      image: string | null;
    } | null;
  }> | null;
  isMember: boolean;
  isLoggedIn: boolean;
}

/**
 * Organization profile component
 *
 * Shows GitHub org info with GRIP overlay if org is linked.
 * Uses dedicated sub-components for layout zones.
 */
export function OrgProfile({
  github,
  repos,
  gripOrg,
  bountyData,
  members,
  isMember,
  isLoggedIn,
}: OrgProfileProps) {
  const [activeTab, setActiveTab] = useState<OrgTab>('bounties');

  // Calculate aggregate stats
  const stats = {
    totalFunded: bountyData?.totalFunded ?? 0n,
    openBounties: bountyData?.funded.filter((b) => b.status === 'open').length ?? 0,
    completedBounties: bountyData?.funded.filter((b) => b.status === 'completed').length ?? 0,
  };

  const memberCount = members?.length ?? 0;
  const repoCount = repos.length;

  // If no gripOrg, construct a dummy object for OrgHeader
  const displayOrg = gripOrg ?? {
    id: 'placeholder',
    name: github.name || github.login,
    slug: github.login,
    logo: github.avatar_url,
    createdAt: new Date(github.created_at || Date.now()),
    metadata: null,
    githubOrgId: BigInt(github.id),
    githubOrgLogin: github.login,
    syncMembership: false,
    lastSyncedAt: null,
    visibility: 'private' as const,
  };

  // Transform bountyData to OrgBountyItem for the bounties list
  const bountyItems: OrgBountyItem[] = useMemo(() => {
    return (bountyData?.funded ?? []).map((b) => ({
      id: b.id,
      title: b.title,
      amount: b.amount,
      status: b.status as OrgBountyItem['status'],
      githubOwner: b.githubOwner,
      githubRepo: b.githubRepo,
      githubIssueNumber: b.githubIssueNumber,
    }));
  }, [bountyData]);

  // Transform bountyData to ActivityItems for the activity tab
  const activityItems: ActivityItem[] = useMemo(() => {
    return (bountyData?.funded ?? []).map((b) => ({
      id: b.id,
      type: b.status === 'completed' ? ('completed' as const) : ('funded' as const),
      title: b.title,
      repoOwner: b.githubOwner,
      repoName: b.githubRepo,
      amount: b.amount,
      date: b.createdAt,
      url: `/${b.githubOwner}/${b.githubRepo}/bounties/${b.id}`,
    }));
  }, [bountyData]);

  // Tab counts
  const tabCounts = {
    bounties: bountyItems.filter((b) => b.status === 'open' || b.status === 'claimed').length,
    repositories: repoCount,
    activity: activityItems.length,
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-5xl mx-auto px-4 sm:px-6">
        <OrgHeader
          org={displayOrg}
          github={github}
          stats={stats}
          memberCount={memberCount}
          repoCount={repoCount}
          members={members}
          isMember={isMember}
          isLoggedIn={isLoggedIn}
        />

        {/* Toolbar */}
        <div className="mt-8">
          <OrgToolbar activeTab={activeTab} onTabChange={setActiveTab} counts={tabCounts} />
        </div>

        {/* Content */}
        <div className="mt-6">
          {activeTab === 'bounties' && <OrgBountiesList bounties={bountyItems} />}
          {activeTab === 'repositories' && (
            <OrgRepos repos={repos} isMember={isMember} orgSlug={displayOrg.slug} />
          )}
          {activeTab === 'activity' && <OrgActivity items={activityItems} />}
        </div>
      </div>
    </div>
  );
}
