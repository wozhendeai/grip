import { db } from '@/db';
import { accessKeys } from '@/db/schema/business';
import { and, eq, isNull } from 'drizzle-orm';
import { networkFilter } from '../network';

/**
 * Get all Access Keys for a user (filtered by current network)
 */
export async function getAccessKeysByUser(userId: string) {
  return db
    .select()
    .from(accessKeys)
    .where(and(eq(accessKeys.userId, userId), networkFilter(accessKeys)))
    .orderBy(accessKeys.createdAt);
}

/**
 * Get active Access Key for a user (filtered by current network)
 * Returns the most recently created active key
 */
export async function getActiveAccessKey(userId: string) {
  const keys = await db
    .select()
    .from(accessKeys)
    .where(
      and(eq(accessKeys.userId, userId), eq(accessKeys.status, 'active'), networkFilter(accessKeys))
    )
    .orderBy(accessKeys.createdAt)
    .limit(1);

  return keys[0] ?? null;
}

/**
 * Get Access Key by ID (with network filter)
 */
export async function getAccessKeyById(id: string) {
  const keys = await db
    .select()
    .from(accessKeys)
    .where(and(eq(accessKeys.id, id), networkFilter(accessKeys)))
    .limit(1);

  return keys[0] ?? null;
}

/**
 * Validate Access Key can be used for a payout
 * Checks: status is active, not expired, has sufficient limits
 */
export async function validateAccessKeyForPayout(params: {
  accessKeyId: string;
  tokenAddress: string;
  amount: bigint;
}): Promise<{ valid: boolean; error?: string }> {
  const key = await getAccessKeyById(params.accessKeyId);

  if (!key) {
    return { valid: false, error: 'Access Key not found' };
  }

  // Check status
  if (key.status !== 'active') {
    return { valid: false, error: 'Access Key is not active' };
  }

  // Check expiry (expiry is stored as bigint Unix timestamp in seconds)
  if (key.expiry && BigInt(Math.floor(Date.now() / 1000)) > key.expiry) {
    return { valid: false, error: 'Access Key has expired' };
  }

  // Check spending limits
  const limits = key.limits as Record<string, { initial: string; remaining: string }>;
  const tokenLimit = limits[params.tokenAddress];

  if (!tokenLimit) {
    return { valid: false, error: `No spending limit set for token ${params.tokenAddress}` };
  }

  const remaining = BigInt(tokenLimit.remaining);
  if (remaining < params.amount) {
    return {
      valid: false,
      error: `Insufficient spending limit: need ${params.amount}, have ${remaining}`,
    };
  }

  return { valid: true };
}
