// lib/tempo/access-keys.ts
import { db } from '@/db';
import { accessKey, member, wallet } from '@/db/schema/auth';
import { and, eq } from 'drizzle-orm';
// Generate unique ID (32 chars like better-auth)
function generateId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint8Array(32);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < 32; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

// ============================================================================
// ORGANIZATION ACCESS KEYS (Team member signs directly)
// ============================================================================

/**
 * Create Access Key for org team member
 *
 * Authorizes team member's passkey wallet to spend from org treasury.
 * - rootWallet = org owner's passkey wallet (account being controlled)
 * - keyWallet = team member's passkey wallet (authorized to sign)
 */
export async function createOrgAccessKey(params: {
  orgId: string;
  teamMemberUserId: string;
  spendingLimits: { tokenAddress: string; amount: bigint }[];
  expiryTimestamp?: number;
  authorizationSignature: string;
  authorizationHash: string;
  chainId: number;
  label?: string;
}) {
  // Get org owner's passkey wallet (root - account being controlled)
  const orgOwner = await db.query.member.findFirst({
    where: and(eq(member.organizationId, params.orgId), eq(member.role, 'owner')),
  });

  if (!orgOwner) {
    throw new Error('Organization has no owner');
  }

  const rootWallet = await db.query.wallet.findFirst({
    where: and(eq(wallet.userId, orgOwner.userId), eq(wallet.walletType, 'passkey')),
  });

  if (!rootWallet) {
    throw new Error('Organization owner has no passkey wallet');
  }

  // Get team member's passkey wallet (key - authorized to sign)
  const teamMemberWallet = await db.query.wallet.findFirst({
    where: and(eq(wallet.userId, params.teamMemberUserId), eq(wallet.walletType, 'passkey')),
  });

  if (!teamMemberWallet) {
    throw new Error('Team member has no passkey wallet');
  }

  // Format limits as JSON string
  const limits = JSON.stringify(
    params.spendingLimits.reduce(
      (acc, l) => {
        acc[l.tokenAddress] = {
          initial: l.amount.toString(),
          remaining: l.amount.toString(),
        };
        return acc;
      },
      {} as Record<string, { initial: string; remaining: string }>
    )
  );

  const now = new Date().toISOString();
  const [key] = await db
    .insert(accessKey)
    .values({
      id: generateId(),
      userId: null,
      organizationId: params.orgId,
      rootWalletId: rootWallet.id,
      keyWalletId: teamMemberWallet.id,
      chainId: params.chainId,
      expiry: params.expiryTimestamp ?? null,
      limits,
      authorizationSignature: params.authorizationSignature,
      authorizationHash: params.authorizationHash,
      status: 'active',
      label: params.label ?? 'Team Access',
      isDedicated: false,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return key;
}

// ============================================================================
// SHARED
// ============================================================================

/**
 * Revoke Access Key (generic function for both personal and org keys)
 */
export async function revokeAccessKeyById(accessKeyId: string, reason: string) {
  const now = new Date().toISOString();
  await db
    .update(accessKey)
    .set({
      status: 'revoked',
      revokedAt: now,
      revokedReason: reason,
      updatedAt: now,
    })
    .where(eq(accessKey.id, accessKeyId));
}
