import { getBountyDataByGitHubId, getUserByName, getUserOrganizations } from '@/db/queries/users';
import { getOrgBySlug, getOrgBountyData, getOrgMembersWithUsers } from '@/db/queries/organizations';
import { getSession } from '@/lib/auth/auth-server';
import {
  fetchGitHubUser,
  fetchGitHubUserActivity,
  fetchGitHubOrgRepositories,
  fetchGitHubUserRepositories,
} from '@/lib/github/api';
import { getOrganization } from '@/lib/github/organizations';
import { notFound } from 'next/navigation';
import { UserProfile } from './_components/user-profile';
import { OrgProfile } from './_components/org-profile';

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
    // Fetch BountyLane org data in parallel
    const [github, repos, bountyData, members] = await Promise.all([
      gripOrg.githubOrgLogin ? getOrganization(gripOrg.githubOrgLogin) : null,
      gripOrg.githubOrgLogin ? fetchGitHubOrgRepositories(gripOrg.githubOrgLogin) : [],
      getOrgBountyData(gripOrg.id),
      getOrgMembersWithUsers(gripOrg.id),
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
    const bountyLaneUser = await getUserByName(owner);
    const bountyData = await getBountyDataByGitHubId(BigInt(githubUser.id));

    // Get org memberships only if user is signed up
    const organizations = bountyLaneUser ? await getUserOrganizations(bountyLaneUser.id) : [];

    // Fetch repos for GitHub-only users
    const repos = !bountyLaneUser ? await fetchGitHubUserRepositories(owner) : [];

    const isOwnProfile = session?.user?.name === owner;
    const isLoggedIn = !!session?.user;

    return (
      <UserProfile
        github={githubUser}
        githubActivity={githubActivity}
        bountyLaneUser={bountyLaneUser}
        bountyData={bountyData}
        organizations={organizations}
        repos={repos}
        isOwnProfile={isOwnProfile}
        isLoggedIn={isLoggedIn}
      />
    );
  }

  // 3. Try GitHub org (permissionless)
  const githubOrg = await getOrganization(owner);
  if (githubOrg) {
    const repos = await fetchGitHubOrgRepositories(owner);
    const isLoggedIn = !!session?.user;

    return (
      <OrgProfile
        github={githubOrg}
        repos={repos}
        gripOrg={null}
        bountyData={null}
        members={null}
        isLoggedIn={isLoggedIn}
      />
    );
  }

  // Neither user nor org exists
  notFound();
}
