'use client';

import { useState, useMemo } from 'react';
import type {
  getBountyDataByGitHubId,
  getUserByName,
  getUserOrganizations,
} from '@/db/queries/users';
import type { getSubmissionsByUser } from '@/db/queries/submissions';
import type { GitHubActivity, GitHubUser, GitHubRepoMinimal } from '@/lib/github';
import { ProfileHeader } from './profile-header';
import { ProfileToolbar, type ProfileTab } from './profile-toolbar';
import { ActivityFeed, type ActivityItem } from './activity-feed';
import { BountyHistory, type BountyItem } from './bounty-history';
import { RepositoriesTab, type RepoItem } from './repositories-tab';

interface UserProfileProps {
  github: GitHubUser;
  githubActivity: GitHubActivity;
  bountyLaneUser: Awaited<ReturnType<typeof getUserByName>>;
  bountyData: Awaited<ReturnType<typeof getBountyDataByGitHubId>>;
  organizations: Awaited<ReturnType<typeof getUserOrganizations>>;
  userSubmissions?: Awaited<ReturnType<typeof getSubmissionsByUser>>;
  repos?: GitHubRepoMinimal[];
  isOwnProfile?: boolean;
  isLoggedIn?: boolean;
}

export function UserProfile({
  github,
  bountyLaneUser,
  bountyData,
  organizations,
  userSubmissions = [],
  repos = [],
}: UserProfileProps) {
  const [activeTab, setActiveTab] = useState<ProfileTab>('activity');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  // Transform data for components
  const { allActivity, allBounties, activeClaims, repoItems } = useMemo(() => {
    // 1. Transform Funded Bounties to Activity
    const fundedActivities: ActivityItem[] = bountyData.funded.map((b) => ({
      id: b.id,
      type: 'funded' as const,
      title: b.title,
      repoOwner: b.repoOwner,
      repoName: b.repoName,
      amount: b.amount,
      date: b.createdAt,
      url: b.repoOwner && b.repoName ? `/${b.repoOwner}/${b.repoName}/bounties/${b.id}` : '#',
    }));

    // 2. Transform Submissions to Activity and Bounties
    const submissionActivities: ActivityItem[] = [];
    const bountyItems: BountyItem[] = [];
    let activeClaimsCount = 0;

    for (const s of userSubmissions) {
      const isPaid = s.submission.status === 'paid';
      const isActive = ['pending', 'approved', 'merged'].includes(s.submission.status);

      if (isPaid) {
        // Completed submission
        submissionActivities.push({
          id: s.bounty.id,
          type: 'completed',
          title: s.bounty.title,
          repoOwner: s.bounty.githubOwner,
          repoName: s.bounty.githubRepo,
          amount: s.bounty.totalFunded,
          date: s.submission.createdAt,
          url:
            s.bounty.githubOwner && s.bounty.githubRepo
              ? `/${s.bounty.githubOwner}/${s.bounty.githubRepo}/bounties/${s.bounty.id}`
              : '#',
        });

        bountyItems.push({
          id: s.bounty.id,
          status: 'completed',
          title: s.bounty.title,
          repoOwner: s.bounty.githubOwner,
          repoName: s.bounty.githubRepo,
          amount: s.bounty.totalFunded,
          date: s.submission.createdAt,
          url:
            s.bounty.githubOwner && s.bounty.githubRepo
              ? `/${s.bounty.githubOwner}/${s.bounty.githubRepo}/bounties/${s.bounty.id}`
              : '#',
        });
      } else if (isActive) {
        // Active/In progress submission
        activeClaimsCount++;

        submissionActivities.push({
          id: s.bounty.id,
          type: 'in_progress',
          title: s.bounty.title,
          repoOwner: s.bounty.githubOwner,
          repoName: s.bounty.githubRepo,
          amount: s.bounty.totalFunded,
          date: s.submission.createdAt,
          url:
            s.bounty.githubOwner && s.bounty.githubRepo
              ? `/${s.bounty.githubOwner}/${s.bounty.githubRepo}/bounties/${s.bounty.id}`
              : '#',
        });

        bountyItems.push({
          id: s.bounty.id,
          status: 'active',
          title: s.bounty.title,
          repoOwner: s.bounty.githubOwner,
          repoName: s.bounty.githubRepo,
          amount: s.bounty.totalFunded,
          date: s.submission.createdAt,
          url:
            s.bounty.githubOwner && s.bounty.githubRepo
              ? `/${s.bounty.githubOwner}/${s.bounty.githubRepo}/bounties/${s.bounty.id}`
              : '#',
        });
      }
    }

    // 3. Transform repos
    const transformedRepos: RepoItem[] = repos.map((repo) => ({
      id: repo.id,
      name: repo.name,
      owner: repo.owner.login,
      description: repo.description,
      bountyCount: 0,
      hasBounties: false,
    }));

    return {
      allActivity: [...fundedActivities, ...submissionActivities],
      allBounties: bountyItems,
      activeClaims: activeClaimsCount,
      repoItems: transformedRepos,
    };
  }, [bountyData, userSubmissions, repos]);

  // Calculate Header Stats
  const totalEarned = BigInt(bountyData.totalEarned);
  const bountiesCompleted = bountyLaneUser?.bountiesCompleted || 0;

  const handleTabChange = (tab: ProfileTab) => {
    setActiveTab(tab);
    setActiveFilter('all');
    setSearchQuery('');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-5xl space-y-8 px-4 sm:px-6">
        <ProfileHeader
          user={{
            avatarUrl: github.avatar_url,
            name: github.name,
            username: github.login,
            bio: github.bio,
            location: github.location,
            website: github.blog,
            joinedAt: bountyLaneUser?.createdAt,
            htmlUrl: github.html_url,
          }}
          stats={{
            totalEarned,
            bountiesCompleted,
            activeClaims,
          }}
          organizations={organizations}
        />

        <ProfileToolbar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />

        {activeTab === 'activity' && (
          <ActivityFeed
            activities={allActivity}
            filter={activeFilter}
            searchQuery={searchQuery}
          />
        )}

        {activeTab === 'bounties' && (
          <BountyHistory
            bounties={allBounties}
            filter={activeFilter}
            searchQuery={searchQuery}
          />
        )}

        {activeTab === 'repositories' && (
          <RepositoriesTab
            repos={repoItems}
            filter={activeFilter}
            searchQuery={searchQuery}
          />
        )}
      </div>
    </div>
  );
}
