import { passkeyClient } from '@better-auth/passkey/client';
import { createAuthClient } from 'better-auth/react';
import { tempoClient } from './tempo-client';

/**
 * better-auth client configuration
 *
 * Provides:
 * - useSession hook for auth state
 * - signIn/signOut methods
 * - passkey.register/authenticate for wallet creation
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  plugins: [passkeyClient(), tempoClient()],
});

export const { signIn, signOut, useSession, passkey } = authClient;
