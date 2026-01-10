'use server';

import { getSession } from '@/lib/auth/auth-server';
import { getAccessKeyByIdForUser } from '@/db/queries/access-keys';
import { revokeAccessKeyById } from '@/lib/tempo/access-keys';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

/**
 * Server action to revoke an access key.
 * Validates ownership before revoking.
 */
export async function revokeAccessKeyAction(keyId: string) {
  const session = await getSession();
  if (!session?.user?.id) {
    return { error: 'Unauthorized' };
  }

  // Verify ownership before revoking
  const accessKey = await getAccessKeyByIdForUser(keyId, session.user.id);
  if (!accessKey) {
    return { error: 'Access key not found' };
  }

  if (accessKey.status !== 'active') {
    return { error: 'Access key is not active' };
  }

  await revokeAccessKeyById(keyId, 'User revoked from settings');

  revalidatePath('/settings/access-keys');
  redirect('/settings/access-keys');
}
