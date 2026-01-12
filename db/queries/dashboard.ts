import { activityLog, bounties, db, payouts, submissions } from '@/db';
import { desc, eq, sql } from 'drizzle-orm';
import { chainIdFilter } from '../network';
import type { ActivityAction } from '@/db/schema/business';
import type { ActivityMetadata } from '@/db/schema/types';

/**
 * Activity feed item for dashboard display
 */
export type ActivityFeedItem = {
  id: string;
  eventType: ActivityAction;
  createdAt: string | null;
  metadata: ActivityMetadata;
  // Joined bounty data (if event relates to a bounty)
  bounty: {
    id: string;
    title: string;
    githubFullName: string;
    githubIssueNumber: number;
    totalFunded: string;
  } | null;
  // Joined payout data (if event relates to a payout)
  payout: {
    id: string;
    amount: string;
    txHash: string | null;
  } | null;
};

/**
 * Get user's activity feed from activity_log table
 *
 * Returns recent events for the user's dashboard.
 * Joins with bounties and payouts to get display data.
 *
 * Event types:
 * - bounty_funded -> "Funded issue #X"
 * - submission_created -> "Claimed issue #X"
 * - payout_sent -> "Received payment"
 */
export async function getUserActivityFeed(
  userId: string,
  limit = 10
): Promise<ActivityFeedItem[]> {
  const results = await db
    .select({
      id: activityLog.id,
      eventType: activityLog.eventType,
      createdAt: activityLog.createdAt,
      metadata: activityLog.metadata,
      bountyId: bounties.id,
      bountyTitle: bounties.title,
      bountyGithubFullName: bounties.githubFullName,
      bountyGithubIssueNumber: bounties.githubIssueNumber,
      bountyTotalFunded: bounties.totalFunded,
      payoutId: payouts.id,
      payoutAmount: payouts.amount,
      payoutTxHash: payouts.txHash,
    })
    .from(activityLog)
    .leftJoin(bounties, eq(activityLog.bountyId, bounties.id))
    .leftJoin(payouts, eq(activityLog.payoutId, payouts.id))
    .where(eq(activityLog.userId, userId))
    .orderBy(desc(activityLog.createdAt))
    .limit(limit);

  return results.map((row) => ({
    id: row.id,
    eventType: row.eventType as ActivityAction,
    createdAt: row.createdAt,
    metadata: (row.metadata ?? {}) as ActivityMetadata,
    bounty: row.bountyId
      ? {
          id: row.bountyId,
          title: row.bountyTitle ?? '',
          githubFullName: row.bountyGithubFullName ?? '',
          githubIssueNumber: row.bountyGithubIssueNumber ?? 0,
          totalFunded: row.bountyTotalFunded?.toString() ?? '0',
        }
      : null,
    payout: row.payoutId
      ? {
          id: row.payoutId,
          amount: row.payoutAmount?.toString() ?? '0',
          txHash: row.payoutTxHash,
        }
      : null,
  }));
}

/**
 * Dashboard stats type
 */
export type DashboardStats = {
  totalEarned: string;
  activeBounties: number;
  contributions: number;
};

/**
 * Get dashboard stats for user
 *
 * Returns:
 * - totalEarned: Sum of confirmed payouts to user
 * - activeBounties: Count of active submissions (pending/approved/merged)
 * - contributions: Count of distinct bounties user has claimed
 */
export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const [earnedResult, activeResult, contributionsResult] = await Promise.all([
    // Total earned: sum of confirmed payouts
    db
      .select({
        total: sql<bigint>`coalesce(sum(${payouts.amount}), 0)::bigint`,
      })
      .from(payouts)
      .where(
        sql`${chainIdFilter(payouts)} AND ${payouts.recipientUserId} = ${userId} AND ${payouts.status} = 'confirmed'`
      ),

    // Active bounties: count of active submissions
    db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(submissions)
      .innerJoin(bounties, eq(submissions.bountyId, bounties.id))
      .where(
        sql`${chainIdFilter(bounties)} AND ${submissions.userId} = ${userId} AND ${submissions.status} IN ('pending', 'approved', 'merged')`
      ),

    // Contributions: count of distinct bounties claimed
    db
      .select({
        count: sql<number>`count(distinct ${submissions.bountyId})::int`,
      })
      .from(submissions)
      .innerJoin(bounties, eq(submissions.bountyId, bounties.id))
      .where(sql`${chainIdFilter(bounties)} AND ${submissions.userId} = ${userId}`),
  ]);

  return {
    totalEarned: (earnedResult[0]?.total ?? BigInt(0)).toString(),
    activeBounties: activeResult[0]?.count ?? 0,
    contributions: contributionsResult[0]?.count ?? 0,
  };
}
