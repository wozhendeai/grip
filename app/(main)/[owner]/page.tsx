import { getBountyDataByGitHubId, getUserByName, getUserOrganizations } from '@/db/queries/users';
import {
  getOrgBySlug,
  getOrgBountyData,
  getOrgMembersWithUsers,
  getOrgRepositories,
  isOrgMember,
} from '@/db/queries/organizations';
import { getSession } from '@/lib/auth/auth-server';
import {
  fetchGitHubUser,
  fetchGitHubUserActivity,
  fetchGitHubOrgRepositories,
  fetchGitHubUserRepositories,
} from '@/lib/github/api';
import { getOrganization } from '@/lib/github';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { UserProfile } from './_components/user-profile';
import { OrgProfile } from './_components/org-profile';

import { getSubmissionsByUser } from '@/db/queries/submissions';

interface OwnerPageProps {
  params: Promise<{ owner: string }>;
}

// Reserved routes that should not be treated as owner names
const RESERVED_ROUTES = new Set([
  'explore',
  'wallet',
  'settings',
  'notifications',
  'login',
  'claim',
  'tx',
  'api',
  'bounties',
]);

function formatAmount(cents: bigint | string | number): string {
  const value = typeof cents === 'bigint' ? Number(cents) : typeof cents === 'string' ? Number(cents) : cents;
  const dollars = value / 1_000_000;
  if (dollars === 0) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(dollars);
}

export async function generateMetadata({ params }: OwnerPageProps): Promise<Metadata> {
  const { owner } = await params;

  if (RESERVED_ROUTES.has(owner)) {
    return { title: 'Not Found' };
  }

  // 1. Try GRIP org first
  const gripOrg = await getOrgBySlug(owner);
  if (gripOrg && gripOrg.visibility === 'public') {
    const bountyData = await getOrgBountyData(gripOrg.id);
    const stats = bountyData
      ? `${bountyData.fundedCount} bounties funded · ${formatAmount(bountyData.totalFunded)} total`
      : 'Organization on GRIP';

    return {
      title: gripOrg.name,
      description: stats,
      openGraph: {
        title: gripOrg.name,
        description: stats,
      },
    };
  }

  // 2. Try GitHub user
  const githubUser = await fetchGitHubUser(owner);
  if (githubUser) {
    const bountyData = await getBountyDataByGitHubId(BigInt(githubUser.id));
    const hasEarned = bountyData.totalEarned > 0;
    const hasFunded = bountyData.totalFunded > 0;

    let description = githubUser.bio || `GitHub profile for ${githubUser.name || githubUser.login}`;
    if (hasEarned || hasFunded) {
      const parts: string[] = [];
      if (hasEarned) parts.push(`${formatAmount(bountyData.totalEarned)} earned`);
      if (hasFunded) parts.push(`${formatAmount(bountyData.totalFunded)} funded`);
      description = parts.join(' · ');
    }

    return {
      title: githubUser.name || githubUser.login,
      description,
      openGraph: {
        title: githubUser.name || githubUser.login,
        description,
      },
    };
  }

  // 3. Try GitHub org
  const githubOrg = await getOrganization(owner);
  if (githubOrg) {
    return {
      title: githubOrg.name ?? githubOrg.login,
      description: githubOrg.description || `GitHub organization ${githubOrg.login}`,
      openGraph: {
        title: githubOrg.name ?? githubOrg.login,
        description: githubOrg.description || 'GitHub organization',
      },
    };
  }

  return { title: 'Profile Not Found' };
}

/**
 * Unified owner profile page - handles both GitHub users and organizations
 *
 * PERMISSIONLESS: Works for ANY GitHub user or org, whether they've signed up or not.
 * Fetches BountyLane entities first (DB), then falls back to GitHub-only profiles.
 *
 * Resolution order:
 * 1. BountyLane org by slug
 * 2. BountyLane user by username
 * 3. GitHub organization
 * 4. GitHub user
 * 5. 404
 */
export default async function OwnerPage({ params }: OwnerPageProps) {
  const { owner } = await params;
  const session = await getSession();

  // Check reserved routes first
  if (RESERVED_ROUTES.has(owner)) {
    notFound();
  }

  // 1. Try BountyLane org first (DB lookup by slug)
  const gripOrg = await getOrgBySlug(owner);
  if (gripOrg) {
    // Check if current user is a member of this org
    const isMember = session?.user ? await isOrgMember(gripOrg.id, session.user.id) : false;

    // Privacy check based on org visibility setting
    // 'private' and 'members_only' require membership to view
    if ((gripOrg.visibility === 'private' || gripOrg.visibility === 'members_only') && !isMember) {
      notFound();
    }

    // Fetch BountyLane org data in parallel
    // Members list is only visible to org members
    const [github, repos, bountyData, members] = await Promise.all([
      gripOrg.githubOrgLogin ? getOrganization(gripOrg.githubOrgLogin) : null,
      getOrgRepositories(gripOrg.id, gripOrg.githubOrgLogin),
      getOrgBountyData(gripOrg.id),
      isMember ? getOrgMembersWithUsers(gripOrg.id) : Promise.resolve(null),
    ]);

    const isLoggedIn = !!session?.user;

    // If org has no GitHub link, create placeholder
    const githubOrg = github ?? {
      id: 0,
      login: gripOrg.slug,
      avatar_url: gripOrg.logo ?? '',
      description: null,
      name: gripOrg.name,
      blog: null,
      location: null,
      email: null,
      public_repos: 0,
      public_gists: 0,
      followers: 0,
      created_at: gripOrg.createdAt.toISOString(),
      updated_at: gripOrg.createdAt.toISOString(),
      html_url: `https://github.com/${gripOrg.githubOrgLogin ?? gripOrg.slug}`,
    };

    return (
      <OrgProfile
        github={githubOrg}
        repos={repos}
        gripOrg={gripOrg}
        bountyData={bountyData}
        members={members}
        isMember={isMember}
        isLoggedIn={isLoggedIn}
      />
    );
  }

  // 2. Try BountyLane user (with GitHub data)
  const [githubUser, githubActivity] = await Promise.all([
    fetchGitHubUser(owner),
    fetchGitHubUserActivity(owner),
  ]);

  if (githubUser) {
    const [bountyLaneUser, bountyData, repos] = await Promise.all([
      getUserByName(owner),
      getBountyDataByGitHubId(BigInt(githubUser.id)),
      fetchGitHubUserRepositories(owner, { sort: 'updated', perPage: 100 }),
    ]);

    // Second batch: depends on bountyLaneUser.id
    const [organizations, userSubmissions] = bountyLaneUser
      ? await Promise.all([
          getUserOrganizations(bountyLaneUser.id, session?.user?.id),
          getSubmissionsByUser(bountyLaneUser.id),
        ])
      : [[], []];

    const isOwnProfile = session?.user?.name === owner;
    const isLoggedIn = !!session?.user;

    return (
      <UserProfile
        github={githubUser}
        githubActivity={githubActivity}
        bountyLaneUser={bountyLaneUser}
        bountyData={bountyData}
        organizations={organizations}
        userSubmissions={userSubmissions}
        repos={repos}
        isOwnProfile={isOwnProfile}
        isLoggedIn={isLoggedIn}
      />
    );
  }

  // 3. Try GitHub org (permissionless)
  const githubOrg = await getOrganization(owner);
  if (githubOrg) {
    const githubRepos = await fetchGitHubOrgRepositories(owner);
    const isLoggedIn = !!session?.user;

    // Map GitHub repos to OrgRepo format (no GRIP stats)
    const repos = githubRepos.map((repo) => ({
      id: BigInt(repo.id),
      owner: repo.owner.login,
      name: repo.name,
      bountyCount: 0,
      totalFunded: 0n,
    }));

    return (
      <OrgProfile
        github={githubOrg}
        repos={repos}
        gripOrg={null}
        bountyData={null}
        members={null}
        isMember={false}
        isLoggedIn={isLoggedIn}
      />
    );
  }

  // Neither user nor org exists
  notFound();
}
