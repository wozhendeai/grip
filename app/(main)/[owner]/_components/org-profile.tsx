'use client';

import { useState } from 'react';
import type { GitHubOrganizationMinimal } from '@/lib/github';
import type { organization } from '@/db/schema/auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { OrgHeader } from './org-header';
import { OrgRepos } from './org-repos';
import type { ActivityItem } from './activity-list';
import { OrgActivity } from './org-activity';

interface OrgRepo {
  id: bigint;
  owner: string;
  name: string;
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
  // Calculate aggregate stats
  const stats = {
    totalFunded: bountyData?.totalFunded ?? 0n,
    openBounties: bountyData?.funded.filter((b) => b.status === 'open').length ?? 0,
    completedBounties: bountyData?.funded.filter((b) => b.status === 'completed').length ?? 0,
  };

  const memberCount = members?.length ?? 0;

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
  };

  // Transform bountyData to ActivityItems
  const activityItems: ActivityItem[] = (bountyData?.funded ?? []).map(
    (b): ActivityItem => ({
      id: b.id,
      type: b.status === 'completed' ? 'completed' : 'funded',
      title: b.title,
      repoOwner: b.githubOwner,
      repoName: b.githubRepo,
      amount: b.amount,
      date: b.createdAt,
      url: `/${b.githubOwner}/${b.githubRepo}/bounties/${b.id}`,
    })
  );

  // State for tabs and filtering
  const [activeTab, setActiveTab] = useState<'repos' | 'activity'>('repos');
  const [activityFilter, setActivityFilter] = useState<'all' | 'funded' | 'completed'>('all');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'value'>('newest');

  // Filter activity items
  const filteredActivity = activityItems
    .filter((item) => activityFilter === 'all' || item.type === activityFilter)
    .sort((a, b) => {
      if (sort === 'value') {
        return Number(b.amount) - Number(a.amount);
      }
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return sort === 'newest' ? dateB - dateA : dateA - dateB;
    });

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-5xl mx-auto px-4 sm:px-6">
        <OrgHeader
          org={displayOrg}
          github={github}
          stats={stats}
          memberCount={memberCount}
          members={members}
          isMember={isMember}
          isLoggedIn={isLoggedIn}
        />

        {/* Control Bar */}
        <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between rounded-xl border border-border bg-card/50 p-1">
          {/* Left: Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'repos' | 'activity')}
            className="w-full lg:w-auto"
          >
            <TabsList variant="line" className="w-full justify-start border-b-0 p-0 h-auto gap-4">
              <TabsTrigger
                value="repos"
                className="rounded-none border-b-2 border-transparent px-2 pb-2 pt-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                Repositories <span className="ml-1.5 text-muted-foreground">{repos.length}</span>
              </TabsTrigger>
              <TabsTrigger
                value="activity"
                className="rounded-none border-b-2 border-transparent px-2 pb-2 pt-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                Activity{' '}
                <span className="ml-1.5 text-muted-foreground">{activityItems.length}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Right: Filter & Sort */}
          <div className="flex items-center gap-2 px-1 pb-1 lg:pb-0">
            {activeTab === 'activity' && (
              <Select
                value={activityFilter}
                onValueChange={(v) => setActivityFilter(v as 'all' | 'funded' | 'completed')}
              >
                <SelectTrigger className="w-[120px] h-9 bg-background/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="funded">Funded</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Select value={sort} onValueChange={(v) => setSort(v as 'newest' | 'oldest' | 'value')}>
              <SelectTrigger className="w-[130px] h-9 bg-background/50 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="value">Highest Value</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Content */}
        <div className="mt-6">
          {activeTab === 'repos' ? (
            <OrgRepos repos={repos} isMember={isMember} orgSlug={displayOrg.slug} />
          ) : (
            <OrgActivity items={filteredActivity} />
          )}
        </div>
      </div>
    </div>
  );
}
