import { db } from '@/db';
import { bounties, payouts, submissions, activityLog, repoSettings } from '@/db/schema/business';
import { member, organization, user } from '@/db/schema/auth';
import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { chainIdFilter } from '../network';
import type { ActivityAction } from '@/db/schema/business';

// ============================================================================
// ORG DASHBOARD STATS
// ============================================================================

export interface OrgDashboardStats {
  totalFunded: bigint;
  activeBounties: number;
  memberCount: number;
  repoCount: number;
}

/**
 * Get aggregate stats for org dashboard header cards
 */
export async function getOrgDashboardStats(orgId: string): Promise<OrgDashboardStats> {
  const [fundingResult, activeBountiesResult, memberResult, repoResult] = await Promise.all([
    // Total funded: sum of bounties funded by this org
    db
      .select({
        total: sql<bigint>`coalesce(sum(${bounties.totalFunded}), 0)::numeric(78,0)`,
      })
      .from(bounties)
      .where(and(chainIdFilter(bounties), eq(bounties.organizationId, orgId))),

    // Active bounties: open bounties funded by this org
    db
      .select({
        count: count(),
      })
      .from(bounties)
      .where(
        and(chainIdFilter(bounties), eq(bounties.organizationId, orgId), eq(bounties.status, 'open'))
      ),

    // Member count
    db
      .select({
        count: count(),
      })
      .from(member)
      .where(eq(member.organizationId, orgId)),

    // Repo count: repos with bounties from this org
    db
      .select({
        count: sql<number>`count(distinct ${bounties.githubRepoId})::int`,
      })
      .from(bounties)
      .where(and(chainIdFilter(bounties), eq(bounties.organizationId, orgId))),
  ]);

  return {
    totalFunded: BigInt(fundingResult[0]?.total ?? 0),
    activeBounties: activeBountiesResult[0]?.count ?? 0,
    memberCount: memberResult[0]?.count ?? 0,
    repoCount: repoResult[0]?.count ?? 0,
  };
}

// ============================================================================
// ORG ACTIVE BOUNTIES
// ============================================================================

export interface OrgActiveBounty {
  id: string;
  title: string;
  repoOwner: string;
  repoName: string;
  issueNumber: number;
  amount: bigint;
  status: 'open' | 'claimed' | 'in_review' | 'completed';
  claimedByUsername: string | null;
}

/**
 * Get active bounties for org dashboard list
 *
 * Returns bounties with submission status overlay:
 * - 'open': no submissions
 * - 'claimed': has pending submission
 * - 'in_review': has approved submission awaiting merge
 * - 'completed': bounty.status === 'completed'
 */
export async function getOrgActiveBounties(
  orgId: string,
  limit = 10
): Promise<OrgActiveBounty[]> {
  // Get bounties with their latest submission using lateral join pattern
  const results = await db
    .select({
      id: bounties.id,
      title: bounties.title,
      repoOwner: bounties.githubOwner,
      repoName: bounties.githubRepo,
      issueNumber: bounties.githubIssueNumber,
      amount: bounties.totalFunded,
      bountyStatus: bounties.status,
    })
    .from(bounties)
    .where(and(chainIdFilter(bounties), eq(bounties.organizationId, orgId)))
    .orderBy(desc(bounties.createdAt))
    .limit(limit);

  // Get submission info separately to avoid correlated subquery issues
  const bountyIds = results.map((r) => r.id);

  const submissionData = bountyIds.length > 0
    ? await db
        .select({
          bountyId: submissions.bountyId,
          status: submissions.status,
          userName: user.name,
        })
        .from(submissions)
        .innerJoin(user, eq(submissions.userId, user.id))
        .where(inArray(submissions.bountyId, bountyIds))
        .orderBy(desc(submissions.createdAt))
    : [];

  // Create a map of bountyId -> latest submission
  const submissionMap = new Map<string, { status: string; userName: string }>();
  for (const sub of submissionData) {
    // Only keep the first (most recent) submission per bounty
    if (!submissionMap.has(sub.bountyId)) {
      submissionMap.set(sub.bountyId, { status: sub.status, userName: sub.userName });
    }
  }

  return results.map((row) => {
    const submission = submissionMap.get(row.id);

    // Determine display status based on bounty status and submission status
    let status: OrgActiveBounty['status'] = 'open';
    if (row.bountyStatus === 'completed') {
      status = 'completed';
    } else if (submission?.status === 'approved' || submission?.status === 'merged') {
      status = 'in_review';
    } else if (submission?.status === 'pending') {
      status = 'claimed';
    }

    return {
      id: row.id,
      title: row.title,
      repoOwner: row.repoOwner,
      repoName: row.repoName,
      issueNumber: row.issueNumber,
      amount: BigInt(row.amount),
      status,
      claimedByUsername: submission?.userName ?? null,
    };
  });
}

// ============================================================================
// ORG ACTIVITY FEED
// ============================================================================

export interface OrgActivityItem {
  id: string;
  type: 'bounty_created' | 'payment' | 'bounty_claimed' | 'bounty_completed';
  title: string;
  description: string;
  timestamp: string;
  meta: string | null;
}

/**
 * Get recent activity for org dashboard feed
 *
 * Pulls from activity_log for bounties owned by this org
 */
export async function getOrgActivityFeed(orgId: string, limit = 10): Promise<OrgActivityItem[]> {
  // Get activity for bounties owned by this org
  const results = await db
    .select({
      id: activityLog.id,
      eventType: activityLog.eventType,
      createdAt: activityLog.createdAt,
      metadata: activityLog.metadata,
      bountyTitle: bounties.title,
      bountyAmount: bounties.totalFunded,
      userName: user.name,
      payoutAmount: payouts.amount,
    })
    .from(activityLog)
    .innerJoin(bounties, eq(activityLog.bountyId, bounties.id))
    .leftJoin(user, eq(activityLog.userId, user.id))
    .leftJoin(payouts, eq(activityLog.payoutId, payouts.id))
    .where(
      and(
        eq(bounties.organizationId, orgId),
        inArray(activityLog.eventType, [
          'bounty_created',
          'bounty_funded',
          'submission_created',
          'submission_approved',
          'payout_sent',
        ])
      )
    )
    .orderBy(desc(activityLog.createdAt))
    .limit(limit);

  return results.map((row) => {
    const eventType = row.eventType as ActivityAction;
    let type: OrgActivityItem['type'] = 'bounty_created';
    let title = '';
    let description = '';
    let meta: string | null = null;

    switch (eventType) {
      case 'bounty_created':
      case 'bounty_funded':
        type = 'bounty_created';
        title = 'New bounty created';
        description = row.bountyTitle ?? '';
        if (row.bountyAmount) {
          meta = formatCurrency(BigInt(row.bountyAmount));
        }
        break;
      case 'submission_created':
        type = 'bounty_claimed';
        title = 'Bounty claimed';
        description = row.userName ? `@${row.userName} claimed ${row.bountyTitle}` : row.bountyTitle ?? '';
        break;
      case 'submission_approved':
        type = 'bounty_completed';
        title = 'Submission approved';
        description = row.bountyTitle ?? '';
        break;
      case 'payout_sent':
        type = 'payment';
        title = 'Payment sent';
        description = row.userName ? `To @${row.userName} for ${row.bountyTitle}` : row.bountyTitle ?? '';
        if (row.payoutAmount) {
          meta = formatCurrency(BigInt(row.payoutAmount));
        }
        break;
    }

    return {
      id: row.id,
      type,
      title,
      description,
      timestamp: row.createdAt ?? '',
      meta,
    };
  });
}

// ============================================================================
// ORG SPENDING DATA
// ============================================================================

export interface OrgSpendingData {
  totalBudget: bigint;
  spent: bigint;
  reserved: bigint;
  available: bigint;
  utilizationPercent: number;
  memberSpending: Array<{
    userId: string;
    userName: string;
    avatar: string | null;
    role: string;
    limit: bigint;
    spent: bigint;
  }>;
}

/**
 * Get spending breakdown for org dashboard
 *
 * Budget model:
 * - totalBudget: sum of all bounties created (total committed)
 * - spent: sum of confirmed payouts
 * - reserved: sum of open bounties (committed but not yet paid)
 * - available: totalBudget - spent - reserved (if using hard budget)
 *
 * For MVP, we treat total funded as the budget since there's no separate budget allocation.
 */
export async function getOrgSpendingData(orgId: string): Promise<OrgSpendingData> {
  const [spentResult, reservedResult, membersResult] = await Promise.all([
    // Spent: confirmed payouts from this org
    db
      .select({
        total: sql<bigint>`coalesce(sum(${payouts.amount}), 0)::numeric(78,0)`,
      })
      .from(payouts)
      .innerJoin(bounties, eq(payouts.bountyId, bounties.id))
      .where(
        and(
          chainIdFilter(payouts),
          eq(bounties.organizationId, orgId),
          eq(payouts.status, 'confirmed')
        )
      ),

    // Reserved: open bounties total
    db
      .select({
        total: sql<bigint>`coalesce(sum(${bounties.totalFunded}), 0)::numeric(78,0)`,
      })
      .from(bounties)
      .where(
        and(chainIdFilter(bounties), eq(bounties.organizationId, orgId), eq(bounties.status, 'open'))
      ),

    // Member spending: payouts by member (via payer user who is org member)
    db
      .select({
        userId: member.userId,
        userName: user.name,
        avatar: user.image,
        role: member.role,
        spent: sql<bigint>`coalesce(sum(${payouts.amount}), 0)::numeric(78,0)`,
      })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .leftJoin(
        payouts,
        and(
          eq(payouts.payerUserId, member.userId),
          eq(payouts.payerOrganizationId, orgId),
          eq(payouts.status, 'confirmed')
        )
      )
      .where(eq(member.organizationId, orgId))
      .groupBy(member.userId, user.name, user.image, member.role)
      .orderBy(desc(sql`sum(${payouts.amount})`)),
  ]);

  const spent = BigInt(spentResult[0]?.total ?? 0);
  const reserved = BigInt(reservedResult[0]?.total ?? 0);
  const totalBudget = spent + reserved;
  const available = 0n; // No separate budget pool in current model

  const utilizationPercent =
    totalBudget > 0n ? Number((spent * 100n) / totalBudget) : 0;

  return {
    totalBudget,
    spent,
    reserved,
    available,
    utilizationPercent,
    memberSpending: membersResult.map((m) => ({
      userId: m.userId,
      userName: m.userName,
      avatar: m.avatar,
      role: m.role,
      limit: 0n, // No per-member limits in current model
      spent: BigInt(m.spent),
    })),
  };
}

// ============================================================================
// ORG REPOSITORIES
// ============================================================================

export interface OrgDashboardRepo {
  id: bigint;
  owner: string;
  name: string;
  bountyCount: number;
}

/**
 * Get repositories with bounty counts for org dashboard nav
 */
export async function getOrgDashboardRepos(
  orgId: string,
  limit = 10
): Promise<OrgDashboardRepo[]> {
  const results = await db
    .select({
      id: bounties.githubRepoId,
      owner: bounties.githubOwner,
      name: bounties.githubRepo,
      bountyCount: count(),
    })
    .from(bounties)
    .where(and(chainIdFilter(bounties), eq(bounties.organizationId, orgId)))
    .groupBy(bounties.githubRepoId, bounties.githubOwner, bounties.githubRepo)
    .orderBy(desc(count()))
    .limit(limit);

  return results.map((r) => ({
    id: r.id,
    owner: r.owner,
    name: r.name,
    bountyCount: r.bountyCount,
  }));
}

// ============================================================================
// HELPERS
// ============================================================================

function formatCurrency(amount: bigint): string {
  // Amounts are stored with 6 decimals (like USDC)
  const dollars = Number(amount) / 1_000_000;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(dollars);
}
