import { createAuthClient } from 'better-auth/react';
import { inferOrgAdditionalFields, organizationClient } from 'better-auth/client/plugins';
import { ac, billingAdmin, bountyManager, member, owner } from './permissions';
import { tempoClient } from './tempo-plugin/client';
import type { auth } from './auth';

/**
 * better-auth client configuration
 *
 * Provides:
 * - useSession hook for auth state
 * - signIn/signOut methods
 * - tempo plugin methods for passkey + wallet management
 * - organization methods for multi-user orgs
 *
 * Passkey registration flow:
 * 1. authClient.getPasskeyRegistrationOptions() - get WebAuthn options from server
 * 2. startRegistration(options) - browser WebAuthn ceremony (@simplewebauthn/browser)
 * 3. authClient.registerPasskey({ response, name }) - verify + create wallet atomically
 */
export const authClient = createAuthClient({
  // Important: keep auth requests on the same origin as the current page.
  // If NEXT_PUBLIC_APP_URL differs from the actual browser origin (e.g. 127.0.0.1 vs localhost),
  // cookies get set on the wrong host and passkey sign-in appears to "work" but leaves you unauthenticated.
  baseURL:
    typeof window === 'undefined'
      ? process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      : window.location.origin,
  plugins: [
    tempoClient(),
    organizationClient({
      ac,
      roles: { owner, billingAdmin, bountyManager, member },
      schema: inferOrgAdditionalFields<typeof auth>(),
    }),
  ],
});

export const { signIn, signOut, useSession, usePasskeys, useAccessKeys } = authClient;
