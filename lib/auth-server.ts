import { headers } from 'next/headers';
import { auth } from './auth';

/**
 * Get the current session from request headers
 * Use in API routes and Server Components
 */
export async function getSession() {
  const headersList = await headers();
  const session = await auth.api.getSession({
    headers: headersList,
  });
  return session;
}

/**
 * Require authentication - throws if not authenticated
 * Returns the session with user and session data
 */
export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }
  return session;
}
