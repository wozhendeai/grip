/**
 * Wagmi Configuration for Tempo SDK WebAuthn Connector
 *
 * This configures the Tempo SDK's webAuthn connector to work with our existing
 * better-auth passkey system. The KeyManager is configured to use our custom
 * HTTP endpoint that reads/writes to the existing passkey database table.
 *
 * Key architectural decision: We keep better-auth for passkey creation and
 * authentication, but use SDK's webAuthn connector for signing transactions.
 * This allows us to:
 * - Keep existing authentication flows unchanged
 * - Migrate signing to SDK for better maintainability
 * - Use a single passkey for both auth and transaction signing
 */

import { tempo } from 'tempo.ts/chains';
import { KeyManager, webAuthn } from 'tempo.ts/wagmi';
import { http, createConfig } from 'wagmi';
import { TEMPO_RPC_URL, TEMPO_TOKENS } from './tempo/constants';

/**
 * Wagmi configuration with Tempo's webAuthn connector
 *
 * Connector: webAuthn
 * - Enables signing transactions with WebAuthn P256 passkeys
 * - KeyManager backed by our custom HTTP endpoints
 * - Reads from existing passkey table in database
 *
 * multiInjectedProviderDiscovery: false
 * - Prevents auto-detection of injected wallets (MetaMask, etc.)
 * - Users should only use treasury passkeys, not external wallets
 */
export const config = createConfig({
  chains: [
    tempo({
      // Use PathUSD as default fee token
      // This is Tempo's native fee token, always available
      feeToken: TEMPO_TOKENS.PATH_USD,
    }),
  ],
  connectors: [
    webAuthn({
      // Custom KeyManager that stores public keys in our database
      // instead of localStorage (which would be lost on logout/device change)
      keyManager: KeyManager.http(
        {
          // Better Auth plugin endpoints for KeyManager
          // SDK expects these specific endpoint properties with :credentialId placeholder
          // The SDK will replace :credentialId with the actual credential ID
          getPublicKey: '/api/auth/tempo/keymanager?credentialId=:credentialId',
          setPublicKey: '/api/auth/tempo/keymanager?credentialId=:credentialId',
        },
        {
          // CRITICAL: Include credentials (cookies) with requests
          // Without this, the session cookie won't be sent and requests will fail with 401
          fetch: (input, init) => {
            return fetch(input, {
              ...init,
              credentials: 'include', // Include cookies for same-origin requests
            });
          },
        }
      ),
    }),
  ],
  // Disable auto-detection of injected wallets
  // GRIP uses treasury passkeys only, not external wallets
  multiInjectedProviderDiscovery: false,
  transports: {
    [tempo().id]: http(TEMPO_RPC_URL),
  },
});

/**
 * Type exports for use in components
 */
declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
