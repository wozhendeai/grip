import { account, bounties, db, passkey, payouts, user } from '@/db';
import { networkFilter } from '@/lib/db/network';
import { and, eq, sql } from 'drizzle-orm';

/**
 * Get user by name with computed stats and wallet address
 *
 * Computes stats from payouts (no cached user_stats table).
 * Joins with passkey for tempoAddress.
 */
export async function getUserByName(name: string) {
  const [result] = await db
    .select({
      user: user,
      wallet: {
        tempoAddress: passkey.tempoAddress,
      },
    })
    .from(user)
    .leftJoin(passkey, eq(user.id, passkey.userId))
    .where(eq(user.name, name))
    .limit(1);

  if (!result) return null;

  // Compute stats from payouts (network-aware)
  const [stats] = await db
    .select({
      totalEarned: sql<number>`coalesce(sum(${payouts.amount}), 0)::bigint`,
      bountiesCompleted: sql<number>`count(distinct ${payouts.bountyId})::int`,
    })
    .from(payouts)
    .where(
      and(
        networkFilter(payouts),
        eq(payouts.recipientUserId, result.user.id),
        eq(payouts.status, 'confirmed')
      )
    );

  return {
    id: result.user.id,
    name: result.user.name,
    email: result.user.email,
    image: result.user.image,
    createdAt: result.user.createdAt,
    githubUserId: result.user.githubUserId,
    tempoAddress: result.wallet?.tempoAddress ?? null,
    totalEarned: stats?.totalEarned ?? 0,
    bountiesCompleted: stats?.bountiesCompleted ?? 0,
  };
}

/**
 * Get user by ID with computed stats and wallet address
 */
export async function getUserById(userId: string) {
  const [result] = await db
    .select({
      user: user,
      wallet: {
        tempoAddress: passkey.tempoAddress,
      },
    })
    .from(user)
    .leftJoin(passkey, eq(user.id, passkey.userId))
    .where(eq(user.id, userId))
    .limit(1);

  if (!result) return null;

  // Compute stats from payouts (network-aware)
  const [stats] = await db
    .select({
      totalEarned: sql<number>`coalesce(sum(${payouts.amount}), 0)::bigint`,
      bountiesCompleted: sql<number>`count(distinct ${payouts.bountyId})::int`,
    })
    .from(payouts)
    .where(
      and(
        networkFilter(payouts),
        eq(payouts.recipientUserId, result.user.id),
        eq(payouts.status, 'confirmed')
      )
    );

  return {
    id: result.user.id,
    name: result.user.name,
    email: result.user.email,
    image: result.user.image,
    createdAt: result.user.createdAt,
    githubUserId: result.user.githubUserId,
    tempoAddress: result.wallet?.tempoAddress ?? null,
    totalEarned: stats?.totalEarned ?? 0,
    bountiesCompleted: stats?.bountiesCompleted ?? 0,
  };
}

/**
 * Get bounty activity for any GitHub user (permissionless)
 *
 * Returns bounty data even if user hasn't signed up with BountyLane.
 * Used for displaying GitHub profiles with overlay of BountyLane activity.
 */
export async function getBountyDataByGitHubId(githubId: bigint | string) {
  const githubIdBigInt = typeof githubId === 'string' ? BigInt(githubId) : githubId;

  // Find user by GitHub ID via account table (may not exist in our DB)
  const [result] = await db
    .select({ user })
    .from(user)
    .innerJoin(account, eq(account.userId, user.id))
    .where(and(eq(account.providerId, 'github'), eq(account.accountId, githubIdBigInt.toString())))
    .limit(1);

  if (!result) {
    // User hasn't signed up yet - return empty activity
    return {
      completed: [],
      funded: [],
      totalEarned: 0,
      totalFunded: 0,
    };
  }

  const foundUser = result.user;

  // Compute stats from payouts (network-aware)
  const [stats] = await db
    .select({
      totalEarned: sql<number>`coalesce(sum(${payouts.amount}), 0)::bigint`,
    })
    .from(payouts)
    .where(
      and(
        networkFilter(payouts),
        eq(payouts.recipientUserId, foundUser.id),
        eq(payouts.status, 'confirmed')
      )
    );

  // Get completed bounties (bounties user received payouts for)
  const completed = await db
    .select({
      bountyId: bounties.id,
      title: bounties.title,
      amount: bounties.totalFunded,
      tokenAddress: bounties.tokenAddress,
      repoOwner: bounties.githubOwner,
      repoName: bounties.githubRepo,
      paidAt: bounties.paidAt,
    })
    .from(payouts)
    .innerJoin(bounties, eq(payouts.bountyId, bounties.id))
    .where(and(networkFilter(payouts), eq(payouts.recipientUserId, foundUser.id)));

  // Get funded bounties (bounties user is primary funder for)
  const funded = await db
    .select({
      id: bounties.id,
      title: bounties.title,
      amount: bounties.totalFunded,
      status: bounties.status,
      repoOwner: bounties.githubOwner,
      repoName: bounties.githubRepo,
      createdAt: bounties.createdAt,
    })
    .from(bounties)
    .where(and(networkFilter(bounties), eq(bounties.primaryFunderId, foundUser.id)));

  return {
    completed,
    funded,
    totalEarned: stats?.totalEarned ?? 0,
    totalFunded: funded.reduce((sum, b) => sum + Number(b.amount), 0),
  };
}

/**
 * Find BountyLane user by GitHub username
 *
 * Used by webhooks to map GitHub PR authors to BountyLane users.
 * Returns user ID if they've signed up, null otherwise.
 *
 * Note: user.name stores GitHub username from OAuth (set in lib/auth.ts)
 */
export async function findUserByGitHubUsername(githubUsername: string): Promise<string | null> {
  const [result] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.name, githubUsername))
    .limit(1);

  return result?.id ?? null;
}

/**
 * Find BountyLane user by canonical GitHub user ID
 *
 * Preferred over username lookup (usernames can change).
 * Uses user.github_user_id added in schema redesign.
 */
export async function findUserByGitHubUserId(
  githubUserId: bigint | string
): Promise<string | null> {
  const userIdBigInt = typeof githubUserId === 'string' ? BigInt(githubUserId) : githubUserId;

  const [result] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.githubUserId, userIdBigInt))
    .limit(1);

  return result?.id ?? null;
}
