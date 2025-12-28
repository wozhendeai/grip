import { db, passkey } from '@/db';
import { accessKeys } from '@/db/schema/business';
import { and, desc, eq } from 'drizzle-orm';
import { networkFilter } from '../network';

/**
 * Get all passkeys for a user
 * Returns passkey data including tempoAddress for wallet display
 */
export async function getPasskeysByUser(userId: string) {
  return db
    .select({
      id: passkey.id,
      name: passkey.name,
      credentialID: passkey.credentialID,
      tempoAddress: passkey.tempoAddress,
      createdAt: passkey.createdAt,
    })
    .from(passkey)
    .where(eq(passkey.userId, userId))
    .orderBy(desc(passkey.createdAt));
}

/**
 * Get the primary passkey (most recent) with tempo address for a user
 * Returns null if user has no passkey with a tempo address
 */
export async function getUserWallet(userId: string) {
  const [wallet] = await db
    .select({
      id: passkey.id,
      name: passkey.name,
      tempoAddress: passkey.tempoAddress,
      createdAt: passkey.createdAt,
    })
    .from(passkey)
    .where(eq(passkey.userId, userId))
    .orderBy(desc(passkey.createdAt))
    .limit(1);

  return wallet ?? null;
}

/**
 * Get passkey by ID
 * Used for looking up treasury passkeys
 */
export async function getPasskeyById(passkeyId: string) {
  const [result] = await db
    .select({
      id: passkey.id,
      name: passkey.name,
      credentialID: passkey.credentialID,
      tempoAddress: passkey.tempoAddress,
      createdAt: passkey.createdAt,
    })
    .from(passkey)
    .where(eq(passkey.id, passkeyId))
    .limit(1);

  return result ?? null;
}

export type UserOnboardingInfo = {
  hasWallet: boolean;
  walletAddress: string | null;
  credentialId: string | null;
  hasAccessKey: boolean;
};

/**
 * Get user wallet and access key info for onboarding
 * Returns combined data needed by the onboarding modal
 */
export async function getUserOnboardingInfo(userId: string): Promise<UserOnboardingInfo> {
  // Get wallet (most recent passkey with tempo address)
  const wallet = await getUserWallet(userId);

  // Check for active access key
  const [activeKey] = await db
    .select({ id: accessKeys.id })
    .from(accessKeys)
    .where(
      and(eq(accessKeys.userId, userId), eq(accessKeys.status, 'active'), networkFilter(accessKeys))
    )
    .limit(1);

  return {
    hasWallet: !!wallet?.tempoAddress,
    walletAddress: wallet?.tempoAddress ?? null,
    credentialId: wallet?.id ?? null,
    hasAccessKey: !!activeKey,
  };
}
