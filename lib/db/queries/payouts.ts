import { bounties, db, passkey, payouts, repoSettings, submissions, user } from '@/db';
import { getNetworkForInsert, networkFilter } from '@/lib/db/network';
import { and, asc, desc, eq, sql } from 'drizzle-orm';

export type PayoutStatus = 'pending' | 'confirmed' | 'failed';

export type CreatePayoutInput = {
  submissionId?: string;
  bountyId: string;
  recipientUserId: string;

  // OPTIONAL for permissionless bounties (bounties without repo settings)
  repoSettingsId?: bigint | string | number | null;

  // Track who's paying (primary funder for bounties)
  payerUserId: string;

  // NULLABLE for custodial payments (contributor has no account yet)
  recipientPasskeyId: string | null;
  recipientAddress: string | null;

  amount: bigint | string;
  tokenAddress: string;
  memoIssueNumber?: number;
  memoPrNumber?: number;
  memoContributor?: string;

  // Custodial wallet tracking (for payments to contributors without wallets)
  custodialWalletId?: string;
  isCustodial?: boolean;
};

export async function createPayout(input: CreatePayoutInput) {
  const amountBigInt = typeof input.amount === 'string' ? BigInt(input.amount) : input.amount;

  // Convert repoSettingsId to BigInt if provided
  const repoSettingsId =
    input.repoSettingsId !== undefined && input.repoSettingsId !== null
      ? typeof input.repoSettingsId === 'string'
        ? BigInt(input.repoSettingsId)
        : typeof input.repoSettingsId === 'number'
          ? BigInt(input.repoSettingsId)
          : input.repoSettingsId
      : null;

  const [payout] = await db
    .insert(payouts)
    .values({
      // Network awareness - automatically set based on deployment
      network: getNetworkForInsert(),

      submissionId: input.submissionId,
      bountyId: input.bountyId,
      recipientUserId: input.recipientUserId,
      repoSettingsId, // NULLABLE for permissionless
      payerUserId: input.payerUserId,
      recipientPasskeyId: input.recipientPasskeyId,
      recipientAddress: input.recipientAddress,
      amount: amountBigInt,
      tokenAddress: input.tokenAddress,
      memoIssueNumber: input.memoIssueNumber,
      memoPrNumber: input.memoPrNumber,
      memoContributor: input.memoContributor,
      custodialWalletId: input.custodialWalletId ?? null,
      isCustodial: input.isCustodial ?? false,
      status: 'pending',
    })
    .returning();

  return payout;
}

export async function getPayoutById(id: string) {
  const [payout] = await db
    .select()
    .from(payouts)
    .where(and(networkFilter(payouts), eq(payouts.id, id)))
    .limit(1);

  return payout ?? null;
}

export async function getPayoutWithDetails(id: string) {
  const [result] = await db
    .select({
      payout: payouts,
      bounty: bounties,
      repoSettings: repoSettings,
      recipient: {
        id: user.id,
        name: user.name,
        image: user.image,
      },
    })
    .from(payouts)
    .innerJoin(bounties, eq(payouts.bountyId, bounties.id))
    .leftJoin(repoSettings, eq(payouts.repoSettingsId, repoSettings.githubRepoId))
    .innerJoin(user, eq(payouts.recipientUserId, user.id))
    .where(and(networkFilter(payouts), eq(payouts.id, id)))
    .limit(1);

  return result ?? null;
}

export async function getPayoutsByUser(userId: string | null) {
  if (!userId) {
    return [];
  }

  return db
    .select({
      payout: payouts,
      bounty: bounties,
      repoSettings: repoSettings,
    })
    .from(payouts)
    .innerJoin(bounties, eq(payouts.bountyId, bounties.id))
    .leftJoin(repoSettings, eq(payouts.repoSettingsId, repoSettings.githubRepoId))
    .where(and(networkFilter(payouts), eq(payouts.recipientUserId, userId)))
    .orderBy(desc(payouts.createdAt));
}

export async function getPayoutsByRepoSettings(repoSettingsId: number | bigint | string) {
  const repoIdValue =
    typeof repoSettingsId === 'string'
      ? BigInt(repoSettingsId)
      : typeof repoSettingsId === 'number'
        ? BigInt(repoSettingsId)
        : repoSettingsId;

  return db
    .select({
      payout: payouts,
      bounty: bounties,
      recipient: {
        id: user.id,
        name: user.name,
        image: user.image,
      },
    })
    .from(payouts)
    .innerJoin(bounties, eq(payouts.bountyId, bounties.id))
    .innerJoin(user, eq(payouts.recipientUserId, user.id))
    .where(and(networkFilter(payouts), eq(payouts.repoSettingsId, repoIdValue)))
    .orderBy(desc(payouts.createdAt));
}

export async function getPayoutBySubmission(submissionId: string) {
  const [payout] = await db
    .select()
    .from(payouts)
    .where(and(networkFilter(payouts), eq(payouts.submissionId, submissionId)))
    .limit(1);

  return payout ?? null;
}

export async function updatePayoutStatus(
  id: string,
  status: PayoutStatus,
  additionalFields?: Partial<{
    txHash: string;
    blockNumber: bigint | string;
    confirmedAt: string;
    memoBytes32: string;
    workReceiptHash: string;
    workReceiptLocator: string;
    errorMessage: string;
  }>
) {
  // Convert blockNumber if present
  const fieldsToSet: Partial<{
    txHash: string;
    blockNumber: bigint;
    confirmedAt: string;
    memoBytes32: string;
    workReceiptHash: string;
    workReceiptLocator: string;
    errorMessage: string;
  }> = {};

  if (additionalFields) {
    if (additionalFields.txHash !== undefined) fieldsToSet.txHash = additionalFields.txHash;
    if (additionalFields.confirmedAt !== undefined)
      fieldsToSet.confirmedAt = additionalFields.confirmedAt;
    if (additionalFields.memoBytes32 !== undefined)
      fieldsToSet.memoBytes32 = additionalFields.memoBytes32;
    if (additionalFields.workReceiptHash !== undefined)
      fieldsToSet.workReceiptHash = additionalFields.workReceiptHash;
    if (additionalFields.workReceiptLocator !== undefined)
      fieldsToSet.workReceiptLocator = additionalFields.workReceiptLocator;
    if (additionalFields.errorMessage !== undefined)
      fieldsToSet.errorMessage = additionalFields.errorMessage;
    if (additionalFields.blockNumber !== undefined) {
      fieldsToSet.blockNumber =
        typeof additionalFields.blockNumber === 'string'
          ? BigInt(additionalFields.blockNumber)
          : additionalFields.blockNumber;
    }
  }

  const [updated] = await db
    .update(payouts)
    .set({
      status,
      ...fieldsToSet,
    })
    .where(and(networkFilter(payouts), eq(payouts.id, id)))
    .returning();

  return updated;
}

export async function markPayoutConfirmed(
  id: string,
  txHash: string,
  blockNumber: bigint | string,
  workReceiptHash?: string
) {
  return updatePayoutStatus(id, 'confirmed', {
    txHash,
    blockNumber,
    confirmedAt: new Date().toISOString(),
    workReceiptHash,
  });
}

export async function markPayoutFailed(id: string, errorMessage: string) {
  return updatePayoutStatus(id, 'failed', { errorMessage });
}

export async function getPendingPayouts() {
  return db
    .select()
    .from(payouts)
    .where(and(networkFilter(payouts), eq(payouts.status, 'pending')))
    .orderBy(payouts.createdAt);
}

export async function getPayoutsByBounty(bountyId: string) {
  return db
    .select({
      payout: payouts,
      recipient: {
        id: user.id,
        name: user.name,
        image: user.image,
      },
    })
    .from(payouts)
    .innerJoin(user, eq(payouts.recipientUserId, user.id))
    .where(and(networkFilter(payouts), eq(payouts.bountyId, bountyId)))
    .orderBy(desc(payouts.createdAt));
}

/**
 * Get payout by transaction hash with full details
 *
 * Used for /tx/[hash] pages
 */
export async function getPayoutByTxHash(txHash: string) {
  const [result] = await db
    .select({
      payout: payouts,
      bounty: bounties,
      repoSettings: repoSettings,
      recipient: {
        id: user.id,
        name: user.name,
        image: user.image,
      },
    })
    .from(payouts)
    .innerJoin(bounties, eq(payouts.bountyId, bounties.id))
    .leftJoin(repoSettings, eq(payouts.repoSettingsId, repoSettings.githubRepoId))
    .innerJoin(user, eq(payouts.recipientUserId, user.id))
    .where(and(networkFilter(payouts), eq(payouts.txHash, txHash)))
    .limit(1);

  return result ?? null;
}

export type TimePeriod = '1m' | '3m' | '6m' | '1y' | '2y' | 'all';

/**
 * Get user earnings aggregated by date for charting
 *
 * Computes from payouts table (no cached user_stats).
 */
export async function getUserEarningsOverTime(userId: string | null, period: TimePeriod = '1y') {
  if (!userId) {
    return [];
  }

  const now = new Date();
  let startDate: Date | null = null;

  switch (period) {
    case '1m':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      break;
    case '3m':
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      break;
    case '6m':
      startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      break;
    case '1y':
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      break;
    case '2y':
      startDate = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
      break;
    default:
      startDate = null;
  }

  const results = await db
    .select({
      // Use TO_CHAR to format date as string in PostgreSQL
      // This ensures the database returns a string, not a Date object
      date: sql<string>`TO_CHAR(date_trunc('day', ${payouts.confirmedAt}), 'YYYY-MM-DD')`,
      amount: sql<number>`sum(${payouts.amount})::bigint`,
    })
    .from(payouts)
    .where(
      and(
        networkFilter(payouts),
        sql`${payouts.recipientUserId} = ${userId}`,
        eq(payouts.status, 'confirmed'),
        startDate ? sql`${payouts.confirmedAt} >= ${startDate.toISOString()}` : undefined
      )
    )
    .groupBy(sql`date_trunc('day', ${payouts.confirmedAt})`)
    .orderBy(sql`date_trunc('day', ${payouts.confirmedAt})`);

  return results;
}

/**
 * Get total earnings for user (computed from payouts)
 *
 * Replaces cached user_stats.totalEarned.
 */
export async function getUserTotalEarnings(userId: string): Promise<number> {
  const [result] = await db
    .select({
      total: sql<number>`coalesce(sum(${payouts.amount}), 0)::bigint`,
    })
    .from(payouts)
    .where(
      and(
        networkFilter(payouts),
        eq(payouts.recipientUserId, userId),
        eq(payouts.status, 'confirmed')
      )
    );

  return result?.total ?? 0;
}

/**
 * Get count of completed bounties for user (computed from payouts)
 *
 * Replaces cached user_stats.bountiesCompleted.
 */
export async function getUserCompletedBountiesCount(userId: string): Promise<number> {
  const [result] = await db
    .select({
      count: sql<number>`count(distinct ${payouts.bountyId})::int`,
    })
    .from(payouts)
    .where(
      and(
        networkFilter(payouts),
        eq(payouts.recipientUserId, userId),
        eq(payouts.status, 'confirmed')
      )
    );

  return result?.count ?? 0;
}

/**
 * Create direct payment payout record
 *
 * Direct payments are person-to-person payments (not tied to bounties).
 * bountyId and submissionId are null for direct payments.
 */
export type CreateDirectPaymentInput = {
  payerUserId: string;
  recipientUserId: string;
  recipientPasskeyId: string | null;
  recipientAddress: string | null;
  amount: bigint | string;
  tokenAddress: string;
  message: string; // User-provided memo message
  custodialWalletId?: string;
  isCustodial?: boolean;
};

export async function createDirectPayment(input: CreateDirectPaymentInput) {
  const amountBigInt = typeof input.amount === 'string' ? BigInt(input.amount) : input.amount;

  const [payout] = await db
    .insert(payouts)
    .values({
      network: getNetworkForInsert(),
      paymentType: 'direct',
      bountyId: null, // No bounty for direct payments
      submissionId: null, // No submission for direct payments
      repoSettingsId: null,
      payerUserId: input.payerUserId,
      recipientUserId: input.recipientUserId,
      recipientPasskeyId: input.recipientPasskeyId,
      recipientAddress: input.recipientAddress,
      amount: amountBigInt,
      tokenAddress: input.tokenAddress,
      memoMessage: input.message, // Store user message
      custodialWalletId: input.custodialWalletId ?? null,
      isCustodial: input.isCustodial ?? false,
      status: 'pending',
    })
    .returning();

  return payout;
}

/**
 * Get direct payments sent by user
 *
 * Used for wallet activity feed "Sent" tab.
 * Returns direct payments (paymentType = 'direct') sent by the user.
 */
export async function getSentDirectPayments(userId: string) {
  return db
    .select({
      payout: payouts,
      recipient: {
        id: user.id,
        name: user.name,
        image: user.image,
      },
    })
    .from(payouts)
    .leftJoin(user, eq(payouts.recipientUserId, user.id))
    .where(
      and(
        networkFilter(payouts),
        eq(payouts.payerUserId, userId),
        eq(payouts.paymentType, 'direct')
      )
    )
    .orderBy(desc(payouts.createdAt));
}

/**
 * Get direct payments received by user
 *
 * Used for user profile to show received direct payments.
 * Returns direct payments (paymentType = 'direct') received by the user.
 */
export async function getReceivedDirectPayments(userId: string) {
  return db
    .select({
      payout: payouts,
      sender: {
        id: user.id,
        name: user.name,
        image: user.image,
      },
    })
    .from(payouts)
    .leftJoin(user, eq(payouts.payerUserId, user.id))
    .where(
      and(
        networkFilter(payouts),
        eq(payouts.recipientUserId, userId),
        eq(payouts.paymentType, 'direct')
      )
    )
    .orderBy(desc(payouts.createdAt));
}
