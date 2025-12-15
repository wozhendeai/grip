import { db } from '@/db';
import { custodialWallets } from '@/db/schema/business';
import { getNetworkForInsert, networkFilter } from '@/lib/db/network';
import { getTIP20Balance } from '@/lib/tempo/balance';
import { and, eq } from 'drizzle-orm';

/**
 * Custodial Wallet Database Queries
 *
 * Handles database operations for Turnkey-managed custodial wallets.
 * These wallets hold funds for contributors who completed bounties
 * but don't have BountyLane accounts yet.
 *
 * Key operations:
 * - Create custodial wallet records after Turnkey wallet creation
 * - Query wallets by GitHub user ID or claim token
 * - Mark wallets as claimed after fund transfer
 * - Query balances for claim flow
 */

/**
 * Create custodial wallet record
 *
 * Called after successfully creating a Turnkey wallet.
 * Stores wallet details, claim token, and expiration.
 *
 * @param input - Wallet details from Turnkey + claim token
 * @returns Created custodial wallet record
 */
export async function createCustodialWalletRecord(input: {
  githubUserId: bigint | string;
  githubUsername: string;
  turnkeyWalletId: string;
  turnkeyAccountId: string;
  address: string;
  claimToken: string;
  claimExpiresAt: Date;
}) {
  const githubUserId =
    typeof input.githubUserId === 'string' ? BigInt(input.githubUserId) : input.githubUserId;

  const [wallet] = await db
    .insert(custodialWallets)
    .values({
      network: getNetworkForInsert(),
      githubUserId,
      githubUsername: input.githubUsername,
      turnkeyWalletId: input.turnkeyWalletId,
      turnkeyAccountId: input.turnkeyAccountId,
      address: input.address,
      claimToken: input.claimToken,
      claimExpiresAt: input.claimExpiresAt.toISOString(),
      status: 'pending',
    })
    .returning();

  return wallet;
}

/**
 * Get custodial wallet by GitHub user ID
 *
 * Used when approving bounties to check if custodial wallet already exists.
 * Returns only active wallets for current network.
 *
 * Design decision: One custodial wallet per GitHub user per network.
 * Multiple payments to same user go to same custodial wallet.
 *
 * @param githubUserId - GitHub user ID
 * @returns Custodial wallet if exists, null otherwise
 */
export async function getCustodialWalletByGithubUserId(githubUserId: bigint | string) {
  const userIdBigInt = typeof githubUserId === 'string' ? BigInt(githubUserId) : githubUserId;

  const [wallet] = await db
    .select()
    .from(custodialWallets)
    .where(
      and(
        eq(custodialWallets.githubUserId, userIdBigInt),
        eq(custodialWallets.status, 'pending'),
        networkFilter(custodialWallets)
      )
    )
    .limit(1);

  return wallet ?? null;
}

/**
 * Get custodial wallet by claim token
 *
 * Used in claim flow when contributor clicks claim link.
 * Claim tokens are network-agnostic (no networkFilter) because
 * the token itself encodes which wallet/network it belongs to.
 *
 * @param token - Claim token from URL
 * @returns Custodial wallet if token valid, null otherwise
 */
export async function getCustodialWalletByClaimToken(token: string) {
  const [wallet] = await db
    .select()
    .from(custodialWallets)
    .where(eq(custodialWallets.claimToken, token))
    .limit(1);

  return wallet ?? null;
}

/**
 * Mark custodial wallet as claimed
 *
 * Called after successfully transferring funds from custodial wallet
 * to user's passkey wallet. Records:
 * - User ID (links custodial wallet to BountyLane account)
 * - Passkey ID (destination wallet)
 * - Transaction hash (proof of transfer)
 * - Claim timestamp
 *
 * @param params - Claim details
 * @returns Updated custodial wallet
 */
export async function markCustodialWalletClaimed(params: {
  walletId: string;
  userId: string;
  passkeyId: string;
  transferTxHash: string;
}) {
  const [updated] = await db
    .update(custodialWallets)
    .set({
      status: 'claimed',
      userId: params.userId,
      transferredToPasskeyId: params.passkeyId,
      transferTxHash: params.transferTxHash,
      claimedAt: new Date().toISOString(),
    })
    .where(eq(custodialWallets.id, params.walletId))
    .returning();

  return updated;
}

/**
 * Get all active custodial wallets for a GitHub user
 *
 * Used for batch claiming: when a contributor signs up, we claim
 * ALL their pending payments at once.
 *
 * Design decision: Batch claiming instead of one-by-one because:
 * - Better UX (single claim flow for all payments)
 * - Fewer transactions (can batch transfers)
 * - Simpler contributor experience
 *
 * @param githubUserId - GitHub user ID
 * @returns Array of active custodial wallets
 */
export async function getActiveCustodialWalletsForGithubUser(githubUserId: bigint | string) {
  const userIdBigInt = typeof githubUserId === 'string' ? BigInt(githubUserId) : githubUserId;

  return db
    .select()
    .from(custodialWallets)
    .where(
      and(
        eq(custodialWallets.githubUserId, userIdBigInt),
        eq(custodialWallets.status, 'pending'),
        networkFilter(custodialWallets)
      )
    );
}

/**
 * Get custodial wallet balance for a specific token
 *
 * Queries Tempo RPC for TIP-20 balance.
 * Used in claim flow to determine how much to transfer.
 *
 * Important: Tempo has no native token, so we must use TIP-20 balanceOf.
 * Never use eth_getBalance - it returns a placeholder number.
 *
 * @param params.address - Custodial wallet address
 * @param params.tokenAddress - TIP-20 token address (e.g., PathUSD)
 * @returns Token balance in smallest unit (e.g., micro-dollars for 6-decimal tokens)
 */
export async function getCustodialWalletBalance(params: {
  address: string;
  tokenAddress: string;
}): Promise<bigint> {
  const balance = await getTIP20Balance(
    params.address as `0x${string}`,
    params.tokenAddress as `0x${string}`
  );
  return balance;
}

/**
 * Get all payouts for a custodial wallet
 *
 * Used to show contributor what they're claiming.
 * Returns all payouts (pending, confirmed, failed) for transparency.
 *
 * @param custodialWalletId - Custodial wallet ID
 * @returns Array of payouts
 */
export async function getPayoutsForCustodialWallet(custodialWalletId: string) {
  const { payouts } = await import('@/db/schema/business');

  return db.select().from(payouts).where(eq(payouts.custodialWalletId, custodialWalletId));
}
