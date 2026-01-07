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
 * Get Access Key by ID with user ownership validation.
 * Used for access key detail pages to ensure users can only view their own keys.
 */
export async function getAccessKeyByIdForUser(id: string, userId: string) {
  const keys = await db
    .select()
    .from(accessKeys)
    .where(and(eq(accessKeys.id, id), eq(accessKeys.userId, userId), networkFilter(accessKeys)))
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
    .from(accessKeys)
    .where(
      and(eq(accessKeys.id, id), eq(accessKeys.organizationId, orgId), networkFilter(accessKeys))
    )
    .limit(1);

  return keys[0] ?? null;
}
