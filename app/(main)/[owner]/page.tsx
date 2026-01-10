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

    // Privacy check for GitHub-linked orgs
    // If linked to GitHub and GitHub org is not publicly accessible, require membership
    //
    // TODO: Plan better privacy support. Current approach has limitations:
    // - Relies on GitHub API returning 404 to detect private orgs (extra API call)
    // - No explicit `isPrivate` field on organization schema
    // - Non-GitHub orgs have no privacy controls at all
    //
    // Better approach would be:
    // 1. Add `visibility: 'public' | 'private' | 'members_only'` to organization schema
    // 2. Set visibility when linking GitHub org (check org.type or visibility API)
    // 3. Allow manual visibility override for non-GitHub orgs
    // 4. Consider what data is visible at each level (profile, repos, bounties, members)
    // 5. Add visibility controls to org settings UI
    if (gripOrg.githubOrgId) {
      const githubOrgAccessible = await getOrganization(gripOrg.githubOrgLogin!);
      if (!githubOrgAccessible && !isMember) {
        // GitHub org is private and user is not a GRIP member - return 404
        notFound();
      }
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
          getUserOrganizations(bountyLaneUser.id),
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
