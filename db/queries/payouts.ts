import { bounties, db, passkey, payouts, repoSettings, submissions, user } from '@/db';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { chainIdFilter, getChainId } from '../network';

export type PayoutStatus = 'pending' | 'confirmed' | 'failed';

export type CreatePayoutInput = {
  submissionId?: string;
  bountyId?: string; // Optional for direct payments
  recipientUserId: string;

  // OPTIONAL for permissionless bounties (bounties without repo settings)
  repoSettingsId?: bigint | string | number | null;

  // Track who's paying (XOR: exactly one must be set)
  payerUserId?: string;
  payerOrganizationId?: string;

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

  // Status (defaults to 'pending')
  status?: PayoutStatus;
};

export async function createPayout(input: CreatePayoutInput) {
  // Validate XOR: exactly one of payerUserId or payerOrganizationId must be set
  if (
    (!input.payerUserId && !input.payerOrganizationId) ||
    (input.payerUserId && input.payerOrganizationId)
  ) {
    throw new Error('Must provide either payerUserId or payerOrganizationId, not both');
  }

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
      chainId: getChainId(),

      submissionId: input.submissionId,
      bountyId: input.bountyId,
      recipientUserId: input.recipientUserId,
      repoSettingsId, // NULLABLE for permissionless
      payerUserId: input.payerUserId ?? null,
      payerOrganizationId: input.payerOrganizationId ?? null,
      recipientPasskeyId: input.recipientPasskeyId,
      recipientAddress: input.recipientAddress,
      amount: amountBigInt,
      tokenAddress: input.tokenAddress,
      memoIssueNumber: input.memoIssueNumber,
      memoPrNumber: input.memoPrNumber,
      memoContributor: input.memoContributor,
      custodialWalletId: input.custodialWalletId ?? null,
      isCustodial: input.isCustodial ?? false,
      status: input.status ?? 'pending',
    })
    .returning();

  return payout;
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
    .where(and(chainIdFilter(payouts), eq(payouts.id, id)))
    .limit(1);

  return result ?? null;
}

export async function getPendingPayoutsByRepoSettings(repoSettingsId: number | bigint | string) {
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
    .where(
      and(
        chainIdFilter(payouts),
        eq(payouts.repoSettingsId, repoIdValue),
        eq(payouts.status, 'pending')
      )
    )
    .orderBy(asc(payouts.createdAt));
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
    .where(and(chainIdFilter(payouts), eq(payouts.id, id)))
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
    .where(and(chainIdFilter(payouts), eq(payouts.txHash, txHash)))
    .limit(1);

  return result ?? null;
}

export type TimePeriod = '1m' | '3m' | '6m' | '1y' | '2y' | 'all';

/**
 * Create direct payment payout record
 *
 * Direct payments are person-to-person payments (not tied to bounties).
 * bountyId and submissionId are null for direct payments.
 */
export type CreateDirectPaymentInput = {
  payerUserId?: string;
  payerOrganizationId?: string;
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
  // Validate XOR: exactly one of payerUserId or payerOrganizationId must be set
  if (
    (!input.payerUserId && !input.payerOrganizationId) ||
    (input.payerUserId && input.payerOrganizationId)
  ) {
    throw new Error('Must provide either payerUserId or payerOrganizationId, not both');
  }

  const amountBigInt = typeof input.amount === 'string' ? BigInt(input.amount) : input.amount;

  const [payout] = await db
    .insert(payouts)
    .values({
      chainId: getChainId(),
      paymentType: 'direct',
      bountyId: null, // No bounty for direct payments
      submissionId: null, // No submission for direct payments
      repoSettingsId: null,
      payerUserId: input.payerUserId ?? null,
      payerOrganizationId: input.payerOrganizationId ?? null,
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
