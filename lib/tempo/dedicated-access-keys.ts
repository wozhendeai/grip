import { db } from '@/db';
import { getNetworkForInsert } from '@/db/network';
import { accessKeys } from '@/db/schema/business';
import { eq } from 'drizzle-orm';
import { BACKEND_WALLET_ADDRESSES } from './constants';

/**
 * Create dedicated Access Key for a single payment
 *
 * Dedicated Access Keys are single-use authorizations with exact amount limits.
 * Used for pending payments when a funder approves a bounty for a contributor without an account.
 *
 * Flow:
 * 1. Funder approves bounty for GitHub user without account
 * 2. Frontend prompts funder to sign KeyAuthorization (passkey signature)
 * 3. Backend calls this function to store the authorization
 * 4. Funds stay in funder's wallet (no custody)
 * 5. When contributor claims, we use this Access Key to sign transfer from funder's wallet
 * 6. Access Key is revoked after claim (single-use pattern)
 *
 * IMPORTANT: This requires funder to sign KeyAuthorization at approval time.
 * Cannot reuse existing Access Key signatures because limits are enforced on-chain
 * and there's no per-bounty scope in the authorization structure.
 *
 * @param params - Access Key creation parameters
 * @returns Created Access Key record
 */
export async function createDedicatedAccessKey(params: {
  userId: string;
  tokenAddress: string;
  amount: bigint;
  authorizationSignature: string;
  authorizationHash: string;
  chainId: number;
}) {
  const network = getNetworkForInsert();
  const backendWalletAddress = BACKEND_WALLET_ADDRESSES[network];

  // Set spending limit to exact payment amount (enforced on-chain)
  const limits = {
    [params.tokenAddress]: {
      initial: params.amount.toString(),
      remaining: params.amount.toString(),
    },
  };

  // 1 year expiration (same as pending payment expiration)
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60);

  const [key] = await db
    .insert(accessKeys)
    .values({
      userId: params.userId,
      network,
      backendWalletAddress,
      keyType: 'secp256k1',
      chainId: params.chainId,
      expiry,
      limits,
      authorizationSignature: params.authorizationSignature,
      authorizationHash: params.authorizationHash,
      status: 'active',
      label: 'Pending Payment',
      isDedicated: true, // Mark as dedicated (single-use)
    })
    .returning();

  return key;
}

/**
 * Revoke dedicated Access Key after payment claimed
 *
 * Single-use pattern: After a pending payment is claimed, we revoke
 * its dedicated Access Key to prevent reuse.
 *
 * This is a safety measure - even if the backend tried to reuse it,
 * the on-chain spending limit would be exhausted and prevent double-spend.
 *
 * @param accessKeyId - UUID of Access Key to revoke
 */
export async function revokeDedicatedAccessKey(accessKeyId: string) {
  await db
    .update(accessKeys)
    .set({
      status: 'revoked',
      revokedAt: new Date().toISOString(),
      revokedReason: 'Payment claimed',
    })
    .where(eq(accessKeys.id, accessKeyId));
}
