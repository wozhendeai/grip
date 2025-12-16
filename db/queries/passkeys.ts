import { db, passkey } from '@/db';
import { desc, eq } from 'drizzle-orm';

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
