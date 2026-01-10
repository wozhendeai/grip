/**
 * Wagmi Configuration for Tempo SDK WebAuthn Connector
 *
 * This configures the Tempo SDK's webAuthn connector to work with our existing
 * better-auth passkey system. The KeyManager uses the passkey endpoints
 * (/tempo/passkeys, /tempo/passkey/register-options) instead of separate
 * keymanager endpoints.
 *
 * Key architectural decision: We keep better-auth for passkey creation and
 * authentication, but use SDK's webAuthn connector for signing transactions.
 * This allows us to:
 * - Keep existing authentication flows unchanged
 * - Migrate signing to SDK for better maintainability
 * - Use a single passkey for both auth and transaction signing
 */

import { defineChain } from 'viem';
import { http, createConfig } from 'wagmi';
import { webAuthn } from 'wagmi/tempo';
import { createTempoKeyManager } from '@/lib/auth/tempo-plugin/client';
import { authClient } from '@/lib/auth/auth-client';

/**
 * Tempo Testnet (Moderato) - Current testnet as of Jan 2026
 *
 * Note: The old "Andantino" testnet (chain ID 42429) is deprecated.
 * Moderato uses chain ID 42431.
 */
export const tempoTestnet = defineChain({
  id: 42431,
  name: 'Tempo Testnet',
  nativeCurrency: { name: 'USD', symbol: 'USD', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.moderato.tempo.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Tempo Explorer', url: 'https://explore.tempo.xyz' },
  },
  testnet: true,
});

/**
 * Wagmi configuration with Tempo's webAuthn connector
 *
 * Connector: webAuthn
 * - Enables signing transactions with WebAuthn P256 passkeys
 * - KeyManager backed by passkey endpoints (no separate keymanager routes)
 * - Reads from existing passkey table in database via /tempo/passkeys
 *
 * multiInjectedProviderDiscovery: false
 * - Prevents auto-detection of injected wallets (MetaMask, etc.)
 * - Users should only use treasury passkeys only, not external wallets
 */
export const config = createConfig({
  chains: [
    // Fee token not specified - protocol handles fallback chain:
    // Transaction → Account preference → Contract → pathUSD
    tempoTestnet,
  ],
  connectors: [
    webAuthn({
      // KeyManager using passkey endpoints - uses /tempo/passkeys for public key lookup
      // and /tempo/passkey/register-options + /tempo/passkey/register for registration
      keyManager: createTempoKeyManager(authClient),
    }),
  ],
  // Disable auto-detection of injected wallets
  // GRIP uses treasury passkeys only, not external wallets
  multiInjectedProviderDiscovery: false,
  transports: {
    [tempoTestnet.id]: http(
      process.env.NEXT_PUBLIC_TEMPO_RPC_URL ?? tempoTestnet.rpcUrls.default.http[0]
    ),
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
