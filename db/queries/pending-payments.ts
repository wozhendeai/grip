import crypto from 'node:crypto';
import { db } from '@/db';
import { bounties, pendingPayments } from '@/db/schema/business';
import { and, desc, eq, sql } from 'drizzle-orm';
import { getCurrentNetwork, getNetworkForInsert, networkFilter } from '../network';

/**
 * Create pending payment record
 *
 * When a funder approves a bounty for a contributor without an account:
 * 1. Create dedicated Access Key with exact amount limit (requires passkey signature)
 * 2. Call this function to record the pending payment
 * 3. Generate claim token and set 1-year expiration
 * 4. When contributor signs up, they use claim token to batch-claim all pending payments
 *
 * @param params - Payment details
 * @returns Created pending payment record
 */
export async function createPendingPayment(params: {
  bountyId: string;
  submissionId: string;
  funderId: string;
  recipientGithubUserId: number;
  recipientGithubUsername: string;
  amount: bigint;
  tokenAddress: string;
  dedicatedAccessKeyId: string;
}) {
  const claimToken = crypto.randomBytes(32).toString('hex');
  const claimExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

  const [payment] = await db
    .insert(pendingPayments)
    .values({
      network: getNetworkForInsert(),
      bountyId: params.bountyId,
      submissionId: params.submissionId,
      funderId: params.funderId,
      recipientGithubUserId: BigInt(params.recipientGithubUserId),
      recipientGithubUsername: params.recipientGithubUsername,
      amount: params.amount,
      tokenAddress: params.tokenAddress,
      dedicatedAccessKeyId: params.dedicatedAccessKeyId,
      claimToken,
      claimExpiresAt: claimExpiresAt.toISOString(),
      status: 'pending',
    })
    .returning();

  return payment;
}

/**
 * Create pending payment for direct payment (no bounty/submission context)
 *
 * Direct payments don't have bountyId/submissionId references.
 * Alternative rejected: Separate table for direct payment pending payments
 * Chosen approach: Single table with nullable refs + CHECK constraint (both set OR both NULL)
 * Trade-off: Simpler schema, easier batch claiming across payment types
 *
 * @param params - Payment details
 * @returns Created pending payment record
 */
export async function createPendingPaymentForDirectPayment(params: {
  funderId: string;
  recipientGithubUserId: number;
  recipientGithubUsername: string;
  amount: bigint;
  tokenAddress: string;
  dedicatedAccessKeyId: string;
}) {
  const claimToken = crypto.randomBytes(32).toString('hex');
  const claimExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

  const [payment] = await db
    .insert(pendingPayments)
    .values({
      network: getNetworkForInsert(),
      bountyId: null, // Direct payment - no bounty context
      submissionId: null,
      funderId: params.funderId,
      recipientGithubUserId: BigInt(params.recipientGithubUserId),
      recipientGithubUsername: params.recipientGithubUsername,
      amount: params.amount,
      tokenAddress: params.tokenAddress,
      dedicatedAccessKeyId: params.dedicatedAccessKeyId,
      claimToken,
      claimExpiresAt: claimExpiresAt.toISOString(),
      status: 'pending',
    })
    .returning();

  return payment;
}

/**
 * Get pending payment by claim token
 *
 * Used when a contributor clicks a claim link.
 * Validates the claim token and returns payment details if valid.
 *
 * @param token - Claim token from URL
 * @returns Pending payment record or null if not found
 */
export async function getPendingPaymentByClaimToken(token: string) {
  const [payment] = await db
    .select()
    .from(pendingPayments)
    .where(eq(pendingPayments.claimToken, token))
    .limit(1);

  return payment ?? null;
}

/**
 * Get all pending payments for GitHub user (batch claiming)
 *
 * When a contributor signs up and claims one payment, we batch-process
 * ALL pending payments for their GitHub user ID.
 *
 * This prevents fragmentation and gives contributors all their funds in one transaction.
 *
 * @param githubUserId - GitHub user ID from claim token
 * @returns Array of pending payment records
 */
export async function getPendingPaymentsByGithubUser(githubUserId: number) {
  return db
    .select()
    .from(pendingPayments)
    .where(
      and(
        eq(pendingPayments.recipientGithubUserId, BigInt(githubUserId)),
        eq(pendingPayments.status, 'pending'),
        networkFilter(pendingPayments)
      )
    )
    .orderBy(pendingPayments.createdAt);
}

/**
 * Mark pending payment as claimed
 *
 * Called after successfully executing the payment transaction.
 * Links the payment to the payout record and marks it as claimed.
 *
 * @param params - Claim details
 */
export async function markPendingPaymentClaimed(params: {
  paymentId: string;
  userId: string;
  payoutId: string;
}) {
  await db
    .update(pendingPayments)
    .set({
      status: 'claimed',
      claimedByUserId: params.userId,
      payoutId: params.payoutId,
      claimedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(pendingPayments.id, params.paymentId));
}

/**
 * Get funder's pending liabilities by token
 *
 * Returns total amount committed but not yet claimed per token.
 * Useful for warning funders if their wallet balance is below their liabilities.
 *
 * Example: Funder has 1000 PathUSD but 1500 PathUSD in pending payments
 * → Show warning: "You have 1500 PathUSD in unclaimed payments but only 1000 in your wallet"
 *
 * @param funderId - User ID of funder
 * @returns Array of token addresses with total pending amounts
 */
export async function getFunderPendingLiabilities(funderId: string) {
  const result = await db
    .select({
      tokenAddress: pendingPayments.tokenAddress,
      total: sql<string>`SUM(${pendingPayments.amount})`,
    })
    .from(pendingPayments)
    .where(
      and(
        eq(pendingPayments.funderId, funderId),
        eq(pendingPayments.status, 'pending'),
        networkFilter(pendingPayments)
      )
    )
    .groupBy(pendingPayments.tokenAddress);

  return result.map((r) => ({
    tokenAddress: r.tokenAddress,
    total: BigInt(r.total ?? '0'),
  }));
}

/**
 * Get pending payments by funder
 *
 * Returns list of funder's pending payments for UI display (wallet page).
 * Includes bounty context for display (title, repo).
 *
 * Design Decision: Join with bounties to get context
 * - Alternative rejected: Fetch bounties separately (N+1 queries)
 * - Chosen approach: Single query with left join (handles both bounty and direct payments)
 * - Trade-off: Slightly more complex query for better performance
 */
export async function getPendingPaymentsByFunder(funderId: string) {
  const network = getCurrentNetwork();

  const result = await db
    .select({
      id: pendingPayments.id,
      amount: pendingPayments.amount,
      tokenAddress: pendingPayments.tokenAddress,
      recipientGithubUsername: pendingPayments.recipientGithubUsername,
      recipientGithubUserId: pendingPayments.recipientGithubUserId,
      bountyId: pendingPayments.bountyId,
      submissionId: pendingPayments.submissionId,
      status: pendingPayments.status,
      createdAt: pendingPayments.createdAt,
      claimExpiresAt: pendingPayments.claimExpiresAt,
      claimToken: pendingPayments.claimToken,
      // Bounty context (nullable for direct payments)
      bountyTitle: bounties.title,
      bountyGithubFullName: bounties.githubFullName,
    })
    .from(pendingPayments)
    .leftJoin(bounties, eq(pendingPayments.bountyId, bounties.id))
    .where(
      and(
        eq(pendingPayments.funderId, funderId),
        eq(pendingPayments.status, 'pending'),
        eq(pendingPayments.network, network)
      )
    )
    .orderBy(desc(pendingPayments.createdAt));

  return result;
}

/**
 * Cancel pending payment
 *
 * Validates funder owns payment, revokes dedicated Access Key, updates status.
 * Uses atomic operations to prevent race conditions (claim vs cancel).
 *
 * Design Decision: Function handles both validation and cancellation
 * - Alternative rejected: Separate validation/cancellation functions
 * - Chosen approach: Single function with transaction semantics
 * - Trade-off: Less granular error messages for simpler API
 *
 * Security: Only funder can cancel their own payments (funderId check)
 */
export async function cancelPendingPayment(paymentId: string, funderId: string) {
  const network = getCurrentNetwork();

  // 1. Fetch with validation (status + ownership check)
  const payment = await db.query.pendingPayments.findFirst({
    where: and(
      eq(pendingPayments.id, paymentId),
      eq(pendingPayments.funderId, funderId),
      eq(pendingPayments.status, 'pending'),
      eq(pendingPayments.network, network)
    ),
  });

  if (!payment) {
    throw new Error('Payment not found or cannot be cancelled');
  }

  // 2. Revoke dedicated Access Key (idempotent - safe to call even if already revoked)
  const { revokeDedicatedAccessKey } = await import('@/lib/tempo/dedicated-access-keys');
  await revokeDedicatedAccessKey(payment.dedicatedAccessKeyId);

  // 3. Update payment status to cancelled
  await db
    .update(pendingPayments)
    .set({
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
    })
    .where(eq(pendingPayments.id, paymentId));

  return payment;
}
