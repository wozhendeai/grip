import { bounties, bountyFunders, db, passkey, repoSettings, submissions, user } from '@/db';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { chainIdFilter, getChainId } from '../network';

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
    chainId: getChainId(),

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
    chainId: getChainId(),
  });

  return bounty;
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
      chainId: bountyFunders.chainId,
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
    .where(and(chainIdFilter(bounties), eq(bounties.id, id)))
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
    .where(and(chainIdFilter(bounties), eq(bounties.id, id)))
    .limit(1);

  return result ?? null;
}

export async function getBountiesByGithubRepoId(githubRepoId: bigint | string) {
  const repoIdBigInt = typeof githubRepoId === 'string' ? BigInt(githubRepoId) : githubRepoId;

  return db
    .select()
    .from(bounties)
    .where(and(chainIdFilter(bounties), eq(bounties.githubRepoId, repoIdBigInt)))
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
  const conditions = [chainIdFilter(bounties)];

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

  if (filters?.labels && filters.labels.length > 0) {
    // Check if labels JSONB array contains ANY of the filtered labels
    // We construct a SQL condition: labels @> '[{"name": "label1"}]' OR labels @> '[{"name": "label2"}]'
    const labelConditions = filters.labels.map(
      (label) => sql`${bounties.labels} @> ${JSON.stringify([{ name: label }])}`
    );
    if (labelConditions.length > 0) {
      conditions.push(sql`(${sql.join(labelConditions, sql` OR `)})`);
    }
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
    .where(and(chainIdFilter(bounties), eq(bounties.id, id)))
    .returning();

  return updated;
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
    .where(and(chainIdFilter(bounties), eq(bounties.id, id)))
    .limit(1);

  return result ?? null;
}

export type SortOption = 'amount' | 'newest' | 'oldest';

export async function getAllBounties(options?: {
  status?: BountyStatus | BountyStatus[];
  sort?: SortOption;
  minAmount?: bigint;
  maxAmount?: bigint;
  labels?: string[];
  limit?: number;
  offset?: number;
}) {
  const conditions = [chainIdFilter(bounties)];

  if (options?.status) {
    const statusFilter = options.status;
    if (Array.isArray(statusFilter)) {
      conditions.push(inArray(bounties.status, statusFilter));
    } else {
      conditions.push(eq(bounties.status, statusFilter));
    }
  }

  if (options?.minAmount !== undefined) {
    conditions.push(sql`${bounties.totalFunded} >= ${options.minAmount}`);
  }

  if (options?.maxAmount !== undefined) {
    conditions.push(sql`${bounties.totalFunded} <= ${options.maxAmount}`);
  }

  if (options?.labels && options.labels.length > 0) {
    const labelConditions = options.labels.map(
      (label) => sql`${bounties.labels} @> ${JSON.stringify([{ name: label }])}`
    );
    if (labelConditions.length > 0) {
      conditions.push(sql`(${sql.join(labelConditions, sql` OR `)})`);
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
          chainIdFilter(payouts),
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
          chainIdFilter(bounties),
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
      .where(and(chainIdFilter(bounties), eq(bounties.primaryFunderId, userId))),

    // Claimed: distinct bounties user has submitted work on
    db
      .select({
        count: sql<number>`count(distinct ${submissions.bountyId})::int`,
      })
      .from(submissions)
      .innerJoin(bounties, eq(submissions.bountyId, bounties.id))
      .where(and(chainIdFilter(bounties), eq(submissions.userId, userId))),
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
  const conditions = [chainIdFilter(bounties), eq(bounties.primaryFunderId, userId)];

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
        chainIdFilter(bounties),
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
      and(chainIdFilter(bounties), eq(submissions.userId, userId), eq(submissions.status, 'paid'))
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
    .where(and(chainIdFilter(bounties), eq(bounties.githubRepoId, repoIdBigInt)));

  return result?.committed ?? BigInt(0);
}

export type OnboardingStatus = {
  githubConnected: boolean;
  walletCreated: boolean;
  repoConnected: boolean;
  firstBountyFunded: boolean;
  firstBountyClaimed: boolean;
  isOrgMember: boolean;
  completedSteps: number;
  totalSteps: number;
  allComplete: boolean;
};

export async function getUserOnboardingStatus(userId: string): Promise<OnboardingStatus> {
  // Import member schema inline to avoid circular dependency
  const { member } = await import('@/db/schema/auth');

  const [walletCount, repoCount, fundedCount, claimedCount, memberCount] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(passkey)
      .where(eq(passkey.userId, userId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(repoSettings)
      .where(eq(repoSettings.verifiedOwnerUserId, userId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(bounties)
      .where(and(chainIdFilter(bounties), eq(bounties.primaryFunderId, userId))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(submissions)
      .innerJoin(bounties, eq(submissions.bountyId, bounties.id))
      .where(and(chainIdFilter(bounties), eq(submissions.userId, userId))),
    db.select({ count: sql<number>`count(*)::int` }).from(member).where(eq(member.userId, userId)),
  ]);

  const status = {
    githubConnected: true, // Implied by session
    walletCreated: (walletCount[0]?.count ?? 0) > 0,
    repoConnected: (repoCount[0]?.count ?? 0) > 0,
    firstBountyFunded: (fundedCount[0]?.count ?? 0) > 0,
    firstBountyClaimed: (claimedCount[0]?.count ?? 0) > 0,
    isOrgMember: (memberCount[0]?.count ?? 0) > 0,
  };

  // Determine which path user is on to calculate completion
  // Core steps for everyone: GitHub + Wallet
  let completedCount = 0;
  const totalSteps = 4; // Default Funder path length

  // Base steps
  if (status.githubConnected) completedCount++;
  if (status.walletCreated || status.isOrgMember) completedCount++;

  // Path specific
  // If user has claimed a bounty, they are certainly a contributor
  // If user has connected repo or funded, they are a funder
  // If org member, they skip wallet/repo steps but usually need to fund
  const isFunderActivity = status.repoConnected || status.firstBountyFunded || status.isOrgMember;
  const isContributorActivity = status.firstBountyClaimed;

  // We'll calculate a generic completedSteps for the UI, but relying on "allComplete" for the logic
  if (status.repoConnected) completedCount++;
  if (status.firstBountyFunded) completedCount++;

  // NOTE: This logic is slightly fuzzy because we don't know intent yet.
  // The UI will handle the display logic.
  // For 'allComplete', we check if EITHER path is done.

  const funderComplete =
    status.githubConnected &&
    (status.walletCreated || status.isOrgMember) &&
    (status.repoConnected || status.isOrgMember) &&
    status.firstBountyFunded;

  const contributorComplete =
    status.githubConnected &&
    (status.walletCreated || status.isOrgMember) &&
    status.firstBountyClaimed;

  return {
    ...status,
    completedSteps: completedCount, // This is just an approximation for now, UI will refine
    totalSteps,
    allComplete: funderComplete || contributorComplete,
  };
}

export type ActiveRepo = {
  githubRepoId: string;
  githubOwner: string;
  githubRepo: string;
  githubFullName: string;
  openCount: number;
  totalFunded: string;
  lastActivity: {
    description: string;
    date: Date;
  } | null;
};

export async function getUserActiveRepos(userId: string, limit = 5): Promise<ActiveRepo[]> {
  // 1. Find relevant repos from 3 sources:
  // - Funded bounties (created by user)
  // - Submissions (claimed by user)
  // - Owned repos (repo_settings)

  // We fetch a bit more than limit to ensure we have enough unique repos after merging
  const fetchLimit = limit * 2;

  const [fundedRepos, submittedRepos, ownedRepos] = await Promise.all([
    // Funded
    db
      .select({
        id: bounties.githubRepoId,
        owner: bounties.githubOwner,
        repo: bounties.githubRepo,
        fullName: bounties.githubFullName,
        date: bounties.createdAt,
        bountyId: bounties.id,
        bountyIssue: bounties.githubIssueNumber,
      })
      .from(bounties)
      .where(and(chainIdFilter(bounties), eq(bounties.primaryFunderId, userId)))
      .orderBy(desc(bounties.createdAt))
      .limit(fetchLimit),

    // Submitted - join bounties to get repo info
    db
      .select({
        id: bounties.githubRepoId,
        owner: bounties.githubOwner,
        repo: bounties.githubRepo,
        fullName: bounties.githubFullName,
        date: submissions.createdAt,
        bountyId: bounties.id,
        bountyIssue: bounties.githubIssueNumber,
      })
      .from(submissions)
      .innerJoin(bounties, eq(submissions.bountyId, bounties.id))
      .where(and(chainIdFilter(bounties), eq(submissions.userId, userId)))
      .orderBy(desc(submissions.createdAt))
      .limit(fetchLimit),

    // Owned
    db
      .select({
        id: repoSettings.githubRepoId,
        owner: repoSettings.githubOwner,
        repo: repoSettings.githubRepo,
        fullName: sql<string>`${repoSettings.githubOwner} || '/' || ${repoSettings.githubRepo}`,
        date: repoSettings.verifiedAt,
      })
      .from(repoSettings)
      .where(eq(repoSettings.verifiedOwnerUserId, userId))
      .orderBy(desc(repoSettings.verifiedAt))
      .limit(fetchLimit),
  ]);

  // 2. Merge and sort by date to get top unique repos
  const activityMap = new Map<
    string,
    {
      id: bigint;
      owner: string;
      repo: string;
      fullName: string;
      lastDate: Date;
      description: string;
    }
  >();

  // Process funded
  for (const item of fundedRepos) {
    const idStr = item.id.toString();
    // Prioritize newer activity
    if (!activityMap.has(idStr) || new Date(item.date!) > activityMap.get(idStr)!.lastDate) {
      activityMap.set(idStr, {
        id: item.id,
        owner: item.owner,
        repo: item.repo,
        fullName: item.fullName,
        lastDate: new Date(item.date!),
        description: `You funded #${item.bountyIssue}`,
      });
    }
  }

  // Process submissions
  for (const item of submittedRepos) {
    const idStr = item.id.toString();
    if (!activityMap.has(idStr) || new Date(item.date!) > activityMap.get(idStr)!.lastDate) {
      activityMap.set(idStr, {
        id: item.id,
        owner: item.owner,
        repo: item.repo,
        fullName: item.fullName,
        lastDate: new Date(item.date!),
        description: `You claimed #${item.bountyIssue}`,
      });
    }
  }

  // Process owned
  for (const item of ownedRepos) {
    const idStr = item.id.toString();
    // If we already have activity (funding/claiming), prefer that description over just "connected"
    // unless connection is NEWER (unlikely for established users, but possible)
    if (!activityMap.has(idStr)) {
      activityMap.set(idStr, {
        id: item.id,
        owner: item.owner,
        repo: item.repo,
        fullName: item.fullName,
        lastDate: new Date(item.date!),
        description: 'Connected repository',
      });
    }
  }

  // Convert to array and sort
  const sortedRepos = Array.from(activityMap.values())
    .sort((a, b) => b.lastDate.getTime() - a.lastDate.getTime())
    .slice(0, limit);

  // 3. Enrich with stats (open count, total value)
  // We can do this with a single aggregation query for these specific repo IDs
  if (sortedRepos.length === 0) return [];

  const repoIds = sortedRepos.map((r) => r.id);

  const stats = await db
    .select({
      id: bounties.githubRepoId,
      openCount: sql<number>`count(*) filter (where ${bounties.status} = 'open')::int`,
      totalFunded: sql<bigint>`coalesce(sum(${bounties.totalFunded}) filter (where ${bounties.status} = 'open'), 0)::bigint`,
    })
    .from(bounties)
    .where(and(chainIdFilter(bounties), inArray(bounties.githubRepoId, repoIds)))
    .groupBy(bounties.githubRepoId);

  const statsMap = new Map(stats.map((s) => [s.id.toString(), s]));

  return sortedRepos.map((repo) => {
    const s = statsMap.get(repo.id.toString());
    return {
      githubRepoId: repo.id.toString(),
      githubOwner: repo.owner,
      githubRepo: repo.repo,
      githubFullName: repo.fullName,
      openCount: s?.openCount ?? 0,
      totalFunded: (s?.totalFunded ?? BigInt(0)).toString(),
      lastActivity: {
        description: repo.description,
        date: repo.lastDate,
      },
    };
  });
}

/**
 * Get bounties for a repo including their submissions
 *
 * Used by the repo page to show "Claimed" status (Open + Submissions)
 */
export async function getRepoBountiesWithSubmissions(githubRepoId: bigint | string) {
  const repoId = typeof githubRepoId === 'string' ? BigInt(githubRepoId) : githubRepoId;

  const rows = await db
    .select({
      bounty: bounties,
      submission: submissions,
    })
    .from(bounties)
    .leftJoin(submissions, eq(bounties.id, submissions.bountyId))
    .where(and(chainIdFilter(bounties), eq(bounties.githubRepoId, repoId)))
    .orderBy(desc(bounties.createdAt));

  // Deduplicate and nest submissions
  const map = new Map<
    string,
    typeof bounties.$inferSelect & { submissions: (typeof submissions.$inferSelect)[] }
  >();

  for (const row of rows) {
    if (!map.has(row.bounty.id)) {
      map.set(row.bounty.id, { ...row.bounty, submissions: [] });
    }
    if (row.submission) {
      map.get(row.bounty.id)!.submissions.push(row.submission);
    }
  }

  return Array.from(map.values());
}
