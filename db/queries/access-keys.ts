import { db } from '@/db';
import { accessKey } from '@/db/schema/auth';
import { and, eq } from 'drizzle-orm';
import { chainIdFilter } from '../network';

/**
 * Get active Access Key for a user (filtered by current network's chainId)
 * Returns the most recently created active key
 */
export async function getActiveAccessKey(userId: string) {
  const keys = await db
    .select()
    .from(accessKey)
    .where(
      and(eq(accessKey.userId, userId), eq(accessKey.status, 'active'), chainIdFilter(accessKey))
    )
    .orderBy(accessKey.createdAt)
    .limit(1);

  return keys[0] ?? null;
}

/**
 * Get Access Key by ID with user ownership validation.
 * Used for access key detail pages to ensure users can only view their own keys.
 */
export async function getAccessKeyByIdForUser(id: string, userId: string) {
  const keys = await db
    .select()
    .from(accessKey)
    .where(and(eq(accessKey.id, id), eq(accessKey.userId, userId), chainIdFilter(accessKey)))
    .limit(1);

  return keys[0] ?? null;
}

// ============================================================================
// ORG ACCESS KEYS
// ============================================================================

/**
 * Get Access Key by ID for org (validates org ownership)
 */
export async function getOrgAccessKeyById(id: string, orgId: string) {
  const keys = await db
    .select()
    .from(accessKey)
    .where(
      and(eq(accessKey.id, id), eq(accessKey.organizationId, orgId), chainIdFilter(accessKey))
    )
    .limit(1);

  return keys[0] ?? null;
}
