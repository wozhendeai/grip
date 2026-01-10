import { db, passkey, wallet } from '@/db';
import { accessKey } from '@/db/schema/auth';
import { and, desc, eq } from 'drizzle-orm';
import { chainIdFilter } from '../network';

/**
 * Get all passkeys for a user with their wallet addresses
 */
export async function getPasskeysByUser(userId: string) {
  return db
    .select({
      id: passkey.id,
      name: passkey.name,
      credentialID: passkey.credentialID,
      createdAt: passkey.createdAt,
      wallet: {
        id: wallet.id,
        address: wallet.address,
        walletType: wallet.walletType,
      },
    })
    .from(passkey)
    .leftJoin(wallet, eq(wallet.passkeyId, passkey.id))
    .where(eq(passkey.userId, userId))
    .orderBy(desc(passkey.createdAt));
}

/**
 * Get the user's passkey wallet (first passkey-type wallet)
 * Returns null if user has no passkey wallet
 */
export async function getUserWallet(userId: string) {
  const [userWallet] = await db
    .select({
      id: wallet.id,
      address: wallet.address,
      walletType: wallet.walletType,
      label: wallet.label,
      createdAt: wallet.createdAt,
      passkeyId: wallet.passkeyId,
    })
    .from(wallet)
    .where(and(eq(wallet.userId, userId), eq(wallet.walletType, 'passkey')))
    .orderBy(desc(wallet.createdAt))
    .limit(1);

  return userWallet ?? null;
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
  // Get passkey wallet
  const userWallet = await getUserWallet(userId);

  // Check for active access key
  const [activeKey] = await db
    .select({ id: accessKey.id })
    .from(accessKey)
    .where(
      and(eq(accessKey.userId, userId), eq(accessKey.status, 'active'), chainIdFilter(accessKey))
    )
    .limit(1);

  return {
    hasWallet: !!userWallet?.address,
    walletAddress: userWallet?.address ?? null,
    credentialId: userWallet?.passkeyId ?? null,
    hasAccessKey: !!activeKey,
  };
}
