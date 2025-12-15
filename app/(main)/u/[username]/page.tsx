import { getSession } from '@/lib/auth-server';
import { getUserWallet } from '@/lib/db/queries/passkeys';
import { getBountyDataByGitHubId, getUserByName } from '@/lib/db/queries/users';
import { fetchGitHubUser, fetchGitHubUserActivity } from '@/lib/github/user';
import { notFound } from 'next/navigation';
import { UserProfile } from './_components/user-profile';

interface UserProfilePageProps {
  params: Promise<{ username: string }>;
}

/**
 * User profile page (public) - PERMISSIONLESS
 *
 * Works for ANY GitHub user, whether they've signed up with BountyLane or not.
 * Fetches from GitHub API first, then overlays BountyLane data if available.
 *
 * This enables permissionless browsing - any GitHub profile can be viewed
 * with their BountyLane activity shown if they've interacted with the platform.
 */
export default async function UserProfilePage({ params }: UserProfilePageProps) {
  const { username } = await params;
  const session = await getSession();

  // 1. Fetch from GitHub (user profile + activity in parallel)
  const [githubUser, githubActivity] = await Promise.all([
    fetchGitHubUser(username),
    fetchGitHubUserActivity(username),
  ]);

  if (!githubUser) {
    // Only 404 if GitHub user doesn't exist
    notFound();
  }

  // 2. Check if they've signed up with BountyLane
  const bountyLaneUser = await getUserByName(username);

  // 3. Get their BountyLane activity (may be empty)
  // getBountyDataByGitHubId expects BigInt, githubUser.id is number from GitHub API
  const bountyData = await getBountyDataByGitHubId(BigInt(githubUser.id));

  const isOwnProfile = session?.user?.name === username;
  const isLoggedIn = !!session?.user;

  return (
    <UserProfile
      github={githubUser}
      githubActivity={githubActivity}
      bountyLaneUser={bountyLaneUser}
      bountyData={bountyData}
      isOwnProfile={isOwnProfile}
      isLoggedIn={isLoggedIn}
    />
  );
}
