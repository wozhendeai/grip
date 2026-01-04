import { bounties, bountyFunders, db, repoSettings, submissions, user } from '@/db';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { getNetworkForInsert, networkFilter } from '../network';

export type BountyStatus = 'open' | 'completed' | 'cancelled';

export type CreateBountyInput = {
  repoSettingsId?: number | null; // OPTIONAL - null for permissionless bounties

  // GitHub repo info (required for all bounties)
  githubRepoId: bigint | string;
  githubOwner: string;
  githubRepo: string;
  githubFullName: string;

  githubIssueNumber: number;
  githubIssueId: bigint | string;
  githubIssueAuthorId?: bigint | string;
  title: string;
  body?: string;
  labels?: Array<{ id: number; name: string; color: string; description?: string }>;
  amount: bigint | string;
  tokenAddress: string;
  primaryFunderId: string; // User who created the bounty (first funder)
};

/**
 * Create bounty with initial funding commitment
 *
 * Creates bounty + bounty_funders entry atomically.
 * First funder becomes primary_funder_id.
 */
export async function createBounty(input: CreateBountyInput) {
  // Convert string inputs to BigInt
  const githubRepoId =
    typeof input.githubRepoId === 'string' ? BigInt(input.githubRepoId) : input.githubRepoId;
  const githubIssueId =
    typeof input.githubIssueId === 'string' ? BigInt(input.githubIssueId) : input.githubIssueId;
  const githubIssueAuthorId = input.githubIssueAuthorId
    ? typeof input.githubIssueAuthorId === 'string'
      ? BigInt(input.githubIssueAuthorId)
      : input.githubIssueAuthorId
    : undefined;
  const amount = typeof input.amount === 'string' ? BigInt(input.amount) : input.amount;

  // Create bounty
  const bountyValues = {
    // Network awareness - automatically set based on deployment
    network: getNetworkForInsert() as 'testnet' | 'mainnet',

    repoSettingsId: input.repoSettingsId ? BigInt(input.repoSettingsId) : null, // NULLABLE

    // GitHub repo fields
    githubRepoId,
    githubOwner: input.githubOwner,
    githubRepo: input.githubRepo,
    githubFullName: input.githubFullName,

    githubIssueNumber: input.githubIssueNumber,
    githubIssueId,
    githubIssueAuthorId,
    title: input.title,
    body: input.body,
    labels: input.labels ?? [],

    // Funding (pooled promise model)
    totalFunded: amount,
    tokenAddress: input.tokenAddress,
    primaryFunderId: input.primaryFunderId,

    status: 'open' as const,
  };

  const [bounty] = await db.insert(bounties).values(bountyValues).returning();

  // Create initial funding commitment
  await db.insert(bountyFunders).values({
    bountyId: bounty.id,
    funderId: input.primaryFunderId,
    amount,
    tokenAddress: input.tokenAddress,
    network: getNetworkForInsert(),
  });

  return bounty;
}

/**
 * Add funding commitment to existing bounty (pooled funding)
 *
 * Multiple users can promise funds for same bounty.
 * Updates bounty.totalFunded with new promise amount.
 */
export async function addBountyFunding(
  bountyId: string,
  funderId: string,
  amount: bigint | string,
  tokenAddress: string
) {
  const amountBigInt = typeof amount === 'string' ? BigInt(amount) : amount;

  // Add funder commitment
  await db.insert(bountyFunders).values({
    bountyId,
    funderId,
    amount: amountBigInt,
    tokenAddress,
    network: getNetworkForInsert(),
  });

  // Update bounty total_funded
  const bounty = await getBountyById(bountyId);
  if (!bounty) return null;

  const [updated] = await db
    .update(bounties)
    .set({
      totalFunded: bounty.totalFunded + amountBigInt,
    })
    .where(and(networkFilter(bounties), eq(bounties.id, bountyId)))
    .returning();

  return updated;
}

/**
 * Withdraw funding commitment from bounty
 *
 * Funder can withdraw BEFORE work is submitted/approved.
 * Updates bounty.totalFunded and sets withdrawnAt timestamp.
 *
 * If primary funder withdraws, next funder becomes primary.
 * If all funders withdraw, bounty status → 'cancelled'.
 */
export async function withdrawBountyFunding(bountyId: string, funderId: string) {
  // Mark funder as withdrawn
  const [withdrawn] = await db
    .update(bountyFunders)
    .set({ withdrawnAt: new Date().toISOString() })
    .where(and(eq(bountyFunders.bountyId, bountyId), eq(bountyFunders.funderId, funderId)))
    .returning();

  if (!withdrawn) return null;

  // Recalculate totalFunded from active commitments
  const activeFunders = await db
    .select()
    .from(bountyFunders)
    .where(and(eq(bountyFunders.bountyId, bountyId), sql`${bountyFunders.withdrawnAt} IS NULL`));

  const totalFunded = activeFunders.reduce((sum, f) => sum + f.amount, BigInt(0));
  const newPrimaryFunder = activeFunders.length > 0 ? activeFunders[0].funderId : null;
  const newStatus = activeFunders.length === 0 ? 'cancelled' : 'open';

  // Update bounty
  const [updated] = await db
    .update(bounties)
    .set({
      totalFunded,
      primaryFunderId: newPrimaryFunder,
      status: newStatus as BountyStatus,
      cancelledAt: newStatus === 'cancelled' ? new Date().toISOString() : null,
    })
    .where(and(networkFilter(bounties), eq(bounties.id, bountyId)))
    .returning();

  return updated;
}

/**
 * Get bounty with funders (pooled funding)
 */
export async function getBountyWithFunders(id: string) {
  const bounty = await getBountyById(id);
  if (!bounty) return null;

  const funders = await db
    .select({
      id: bountyFunders.id,
      funderId: bountyFunders.funderId,
      amount: bountyFunders.amount,
      tokenAddress: bountyFunders.tokenAddress,
      network: bountyFunders.network,
      createdAt: bountyFunders.createdAt,
      withdrawnAt: bountyFunders.withdrawnAt,
      funder: {
        id: user.id,
        name: user.name,
        image: user.image,
      },
    })
    .from(bountyFunders)
    .innerJoin(user, eq(bountyFunders.funderId, user.id))
    .where(eq(bountyFunders.bountyId, id))
    .orderBy(bountyFunders.createdAt);

  return { ...bounty, funders };
}

export async function getBountyById(id: string) {
  const [bounty] = await db
    .select()
    .from(bounties)
    .where(and(networkFilter(bounties), eq(bounties.id, id)))
    .limit(1);

  return bounty ?? null;
}

export async function getBountyWithRepoSettings(id: string) {
  const [result] = await db
    .select({
      bounty: bounties,
      repoSettings: repoSettings,
    })
    .from(bounties)
    .innerJoin(repoSettings, eq(bounties.repoSettingsId, repoSettings.githubRepoId))
    .where(and(networkFilter(bounties), eq(bounties.id, id)))
    .limit(1);

  return result ?? null;
}

export async function getBountiesByGithubRepoId(githubRepoId: bigint | string) {
  const repoIdBigInt = typeof githubRepoId === 'string' ? BigInt(githubRepoId) : githubRepoId;

  return db
    .select()
    .from(bounties)
    .where(and(networkFilter(bounties), eq(bounties.githubRepoId, repoIdBigInt)))
    .orderBy(desc(bounties.createdAt));
}

export type BountyFilters = {
  status?: BountyStatus | BountyStatus[];
  minAmount?: bigint;
  maxAmount?: bigint;
  labels?: string[];
  limit?: number;
  offset?: number;
};

export async function getOpenBounties(filters?: BountyFilters) {
  const conditions = [networkFilter(bounties)];

  // Default to open bounties only
  const statusFilter = filters?.status ?? 'open';
  if (Array.isArray(statusFilter)) {
    conditions.push(inArray(bounties.status, statusFilter));
  } else {
    conditions.push(eq(bounties.status, statusFilter));
  }

  if (filters?.minAmount !== undefined) {
    conditions.push(sql`${bounties.totalFunded} >= ${filters.minAmount}`);
  }

  if (filters?.maxAmount !== undefined) {
    conditions.push(sql`${bounties.totalFunded} <= ${filters.maxAmount}`);
  }

  const query = db
    .select({
      bounty: bounties,
      repoSettings: repoSettings,
    })
    .from(bounties)
    .leftJoin(repoSettings, eq(bounties.repoSettingsId, repoSettings.githubRepoId))
    .where(and(...conditions))
    .orderBy(desc(bounties.createdAt))
    .limit(filters?.limit ?? 50)
    .offset(filters?.offset ?? 0);

  return query;
}

export async function updateBountyStatus(
  id: string,
  status: BountyStatus,
  additionalFields?: Partial<{
    approvedAt: string | null;
    ownerApprovedAt: string | null;
    paidAt: string | null;
    cancelledAt: string | null;
  }>
) {
  const [updated] = await db
    .update(bounties)
    .set({
      status,
      ...additionalFields,
    })
    .where(and(networkFilter(bounties), eq(bounties.id, id)))
    .returning();

  return updated;
}

/**
 * Get bounty by GitHub issue ID (canonical reference)
 *
 * Works for any repository (permissionless).
 * Uses githubIssueId (immutable) instead of issueNumber.
 */
export async function getBountyByGitHubIssueId(githubIssueId: bigint | string) {
  const issueIdBigInt = typeof githubIssueId === 'string' ? BigInt(githubIssueId) : githubIssueId;

  const [bounty] = await db
    .select()
    .from(bounties)
    .where(and(networkFilter(bounties), eq(bounties.githubIssueId, issueIdBigInt)))
    .limit(1);

  return bounty ?? null;
}

/**
 * Get bounties with submissions (race condition model)
 */
export async function getBountiesWithSubmissions(userId: string | null) {
  if (!userId) {
    return [];
  }

  return db
    .select({
      bounty: bounties,
      repoSettings: repoSettings,
      submission: submissions,
    })
    .from(submissions)
    .innerJoin(bounties, eq(submissions.bountyId, bounties.id))
    .leftJoin(repoSettings, eq(bounties.repoSettingsId, repoSettings.githubRepoId))
    .where(and(networkFilter(bounties), eq(submissions.userId, userId)))
    .orderBy(desc(submissions.createdAt));
}

export async function getBountyWithAuthor(id: string) {
  const [result] = await db
    .select({
      bounty: bounties,
      repoSettings: repoSettings,
      author: {
        id: user.id,
        name: user.name,
        image: user.image,
      },
    })
    .from(bounties)
    .leftJoin(repoSettings, eq(bounties.repoSettingsId, repoSettings.githubRepoId))
    .leftJoin(user, eq(bounties.primaryFunderId, user.id))
    .where(and(networkFilter(bounties), eq(bounties.id, id)))
    .limit(1);

  return result ?? null;
}

/**
 * Aggregate queries for bounty stats
 */
export async function getBountyStats() {
  const [stats] = await db
    .select({
      totalBounties: sql<number>`count(*)::int`,
      openBounties: sql<number>`count(*) filter (where ${bounties.status} = 'open')::int`,
      completedBounties: sql<number>`count(*) filter (where ${bounties.status} = 'completed')::int`,
      amountOpen: sql<bigint>`coalesce(sum(${bounties.totalFunded}) filter (where ${bounties.status} = 'open'), 0)::bigint`,
      amountPaid: sql<bigint>`coalesce(sum(${bounties.totalFunded}) filter (where ${bounties.status} = 'completed'), 0)::bigint`,
      reposWithBounties: sql<number>`count(distinct ${bounties.githubRepoId})::int`,
    })
    .from(bounties)
    .where(networkFilter(bounties));

  return {
    totalBounties: stats?.totalBounties ?? 0,
    openBounties: stats?.openBounties ?? 0,
    completedBounties: stats?.completedBounties ?? 0,
    // Convert BigInt to string for JSON serialization
    amountOpen: (stats?.amountOpen ?? BigInt(0)).toString(),
    amountPaid: (stats?.amountPaid ?? BigInt(0)).toString(),
    reposWithBounties: stats?.reposWithBounties ?? 0,
  };
}

export type SortOption = 'amount' | 'newest' | 'oldest';

export async function getAllBounties(options?: {
  status?: BountyStatus | BountyStatus[];
  sort?: SortOption;
  limit?: number;
  offset?: number;
}) {
  const conditions = [networkFilter(bounties)];

  if (options?.status) {
    const statusFilter = options.status;
    if (Array.isArray(statusFilter)) {
      conditions.push(inArray(bounties.status, statusFilter));
    } else {
      conditions.push(eq(bounties.status, statusFilter));
    }
  }

  // Determine sort order
  let orderBy: ReturnType<typeof desc> | ReturnType<typeof sql>;
  switch (options?.sort) {
    case 'amount':
      orderBy = desc(bounties.totalFunded);
      break;
    case 'oldest':
      orderBy = sql`${bounties.createdAt} asc`;
      break;
    default:
      orderBy = desc(bounties.createdAt);
  }

  return db
    .select({
      bounty: bounties,
      repoSettings: repoSettings,
    })
    .from(bounties)
    .leftJoin(repoSettings, eq(bounties.repoSettingsId, repoSettings.githubRepoId))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(options?.limit ?? 100)
    .offset(options?.offset ?? 0);
}

/**
 * Get bounty with OPTIONAL repo settings (left join for permissionless bounties)
 *
 * Returns bounty regardless of whether it has repo_settings.
 * Use this for approval/payout flows that handle permissionless bounties.
 */
export async function getBountyWithOptionalRepoSettings(id: string) {
  const [result] = await db
    .select({
      bounty: bounties,
      repoSettings: repoSettings,
    })
    .from(bounties)
    .leftJoin(repoSettings, eq(bounties.repoSettingsId, repoSettings.githubRepoId))
    .where(and(networkFilter(bounties), eq(bounties.id, id)))
    .limit(1);

  return result ?? null;
}

/**
 * Check if user is primary funder for bounty (controls approval)
 *
 * Returns true if user is the primary_funder_id.
 * Primary funder is first funder who hasn't withdrawn.
 */
export async function isUserPrimaryFunder(bountyId: string, userId: string): Promise<boolean> {
  const bounty = await getBountyById(bountyId);
  return bounty?.primaryFunderId === userId;
}

// =============================================================================
// DASHBOARD QUERIES
// =============================================================================

export type DashboardStats = {
  earned: { total: string; count: number };
  pending: { total: string; count: number };
  created: { total: string; count: number };
  claimed: { count: number };
};

/**
 * Get comprehensive dashboard stats for user
 *
 * Computes all stats in parallel for performance.
 * Used in Dashboard header stats.
 */
export async function getUserDashboardStats(userId: string): Promise<DashboardStats> {
  // Import payouts inline to avoid circular dependency
  const { payouts } = await import('@/db');

  const [earnedResult, pendingResult, createdResult, claimedResult] = await Promise.all([
    // Earned: confirmed payouts to this user
    db
      .select({
        total: sql<bigint>`coalesce(sum(${payouts.amount}), 0)::bigint`,
        count: sql<number>`count(*)::int`,
      })
      .from(payouts)
      .where(
        and(
          networkFilter(payouts),
          eq(payouts.recipientUserId, userId),
          eq(payouts.status, 'confirmed')
        )
      ),

    // Pending: approved/merged submissions not yet paid
    db
      .select({
        total: sql<bigint>`coalesce(sum(${bounties.totalFunded}), 0)::bigint`,
        count: sql<number>`count(*)::int`,
      })
      .from(submissions)
      .innerJoin(bounties, eq(submissions.bountyId, bounties.id))
      .leftJoin(payouts, eq(submissions.id, payouts.submissionId))
      .where(
        and(
          networkFilter(bounties),
          eq(submissions.userId, userId),
          inArray(submissions.status, ['approved', 'merged']),
          sql`${payouts.id} IS NULL` // No payout exists yet
        )
      ),

    // Created: bounties where user is primary funder
    db
      .select({
        total: sql<bigint>`coalesce(sum(${bounties.totalFunded}), 0)::bigint`,
        count: sql<number>`count(*)::int`,
      })
      .from(bounties)
      .where(and(networkFilter(bounties), eq(bounties.primaryFunderId, userId))),

    // Claimed: distinct bounties user has submitted work on
    db
      .select({
        count: sql<number>`count(distinct ${submissions.bountyId})::int`,
      })
      .from(submissions)
      .innerJoin(bounties, eq(submissions.bountyId, bounties.id))
      .where(and(networkFilter(bounties), eq(submissions.userId, userId))),
  ]);

  return {
    earned: {
      total: (earnedResult[0]?.total ?? BigInt(0)).toString(),
      count: earnedResult[0]?.count ?? 0,
    },
    pending: {
      total: (pendingResult[0]?.total ?? BigInt(0)).toString(),
      count: pendingResult[0]?.count ?? 0,
    },
    created: {
      total: (createdResult[0]?.total ?? BigInt(0)).toString(),
      count: createdResult[0]?.count ?? 0,
    },
    claimed: {
      count: claimedResult[0]?.count ?? 0,
    },
  };
}

export type CreatedBountyWithSubmissionCount = {
  bounty: typeof bounties.$inferSelect;
  repoSettings: typeof repoSettings.$inferSelect | null;
  submissionCount: number;
  activeSubmissionCount: number;
};

/**
 * Get bounties created by user (where user is primary funder)
 *
 * Returns bounties with their current status and submission counts.
 * Used in Dashboard "Created" tab.
 */
export async function getBountiesCreatedByUser(
  userId: string,
  options?: {
    status?: BountyStatus | BountyStatus[];
    limit?: number;
    offset?: number;
  }
): Promise<CreatedBountyWithSubmissionCount[]> {
  const conditions = [networkFilter(bounties), eq(bounties.primaryFunderId, userId)];

  if (options?.status) {
    if (Array.isArray(options.status)) {
      conditions.push(inArray(bounties.status, options.status));
    } else {
      conditions.push(eq(bounties.status, options.status));
    }
  }

  const results = await db
    .select({
      bounty: bounties,
      repoSettings: repoSettings,
      submissionCount: sql<number>`count(${submissions.id})::int`,
      activeSubmissionCount: sql<number>`count(${submissions.id}) filter (where ${submissions.status} in ('pending', 'approved', 'merged'))::int`,
    })
    .from(bounties)
    .leftJoin(repoSettings, eq(bounties.repoSettingsId, repoSettings.githubRepoId))
    .leftJoin(submissions, eq(bounties.id, submissions.bountyId))
    .where(and(...conditions))
    .groupBy(bounties.id, repoSettings.githubRepoId)
    .orderBy(desc(bounties.createdAt))
    .limit(options?.limit ?? 50)
    .offset(options?.offset ?? 0);

  return results;
}

export type ClaimedBountyListItem = {
  submission: typeof submissions.$inferSelect;
  bounty: typeof bounties.$inferSelect;
  repoSettings: typeof repoSettings.$inferSelect | null;
};

/**
 * Get bounties user has claimed (submitted work for)
 *
 * Returns active submissions (not paid yet).
 * Used in Dashboard "Claimed" tab.
 */
export async function getUserActiveSubmissions(
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<ClaimedBountyListItem[]> {
  return db
    .select({
      submission: submissions,
      bounty: bounties,
      repoSettings: repoSettings,
    })
    .from(submissions)
    .innerJoin(bounties, eq(submissions.bountyId, bounties.id))
    .leftJoin(repoSettings, eq(bounties.repoSettingsId, repoSettings.githubRepoId))
    .where(
      and(
        networkFilter(bounties),
        eq(submissions.userId, userId),
        inArray(submissions.status, ['pending', 'approved', 'merged'])
      )
    )
    .orderBy(desc(submissions.createdAt))
    .limit(options?.limit ?? 50)
    .offset(options?.offset ?? 0);
}

export type CompletedBountyListItem = {
  submission: typeof submissions.$inferSelect;
  bounty: typeof bounties.$inferSelect;
  repoSettings: typeof repoSettings.$inferSelect | null;
  payout: {
    id: string;
    amount: bigint;
    confirmedAt: string | null;
    txHash: string | null;
  } | null;
};

/**
 * Get bounties where user was paid
 *
 * Returns submissions with status 'paid' and payout details.
 * Used in Dashboard "Completed" tab.
 */
export async function getCompletedBountiesByUser(
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<CompletedBountyListItem[]> {
  // Import payouts inline to avoid circular dependency
  const { payouts } = await import('@/db');

  return db
    .select({
      submission: submissions,
      bounty: bounties,
      repoSettings: repoSettings,
      payout: {
        id: payouts.id,
        amount: payouts.amount,
        confirmedAt: payouts.confirmedAt,
        txHash: payouts.txHash,
      },
    })
    .from(submissions)
    .innerJoin(bounties, eq(submissions.bountyId, bounties.id))
    .leftJoin(repoSettings, eq(bounties.repoSettingsId, repoSettings.githubRepoId))
    .leftJoin(payouts, eq(submissions.id, payouts.submissionId))
    .where(
      and(networkFilter(bounties), eq(submissions.userId, userId), eq(submissions.status, 'paid'))
    )
    .orderBy(desc(submissions.createdAt))
    .limit(options?.limit ?? 50)
    .offset(options?.offset ?? 0);
}

/**
 * Get total committed balance for a repo (sum of open bounty amounts)
 *
 * "Committed" = total funds promised to open bounties.
 * Used in treasury settings to show how much is allocated.
 */
export async function getCommittedBalanceByRepoId(githubRepoId: bigint | string): Promise<bigint> {
  const repoIdBigInt = typeof githubRepoId === 'string' ? BigInt(githubRepoId) : githubRepoId;

  const [result] = await db
    .select({
      committed: sql<bigint>`coalesce(sum(${bounties.totalFunded}) filter (where ${bounties.status} = 'open'), 0)::bigint`,
    })
    .from(bounties)
    .where(and(networkFilter(bounties), eq(bounties.githubRepoId, repoIdBigInt)));

  return result?.committed ?? BigInt(0);
}
