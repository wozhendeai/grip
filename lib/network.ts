/**
 * Network configuration
 *
 * Chain ID is the primary abstraction. Safe for client and server use.
 * Database-specific utilities (filters, etc.) are in db/network.ts.
 *
 * Tempo chain IDs:
 * - 42431: Moderato testnet (current)
 * - 42430: Mainnet (TBD)
 *
 * NOTE: Chain IDs are hardcoded here to avoid circular imports with wagmi-config.
 * If chain IDs change, update both here and in wagmi-config.ts.
 */

/** Known Tempo chain IDs */
export const TEMPO_CHAIN_IDS = {
  TESTNET: 42431, // Moderato
  MAINNET: 42430, // TBD
} as const;

export type Network = 'testnet' | 'mainnet';

/**
 * Get current chain ID from environment
 *
 * Safe for client and server use (reads NEXT_PUBLIC_ env var).
 * Falls back to testnet if not set.
 */
export function getChainId(): number {
  const chainIdStr = process.env.NEXT_PUBLIC_TEMPO_CHAIN_ID;
  if (!chainIdStr) {
    return TEMPO_CHAIN_IDS.TESTNET;
  }
  const chainId = Number.parseInt(chainIdStr, 10);
  if (Number.isNaN(chainId)) {
    return TEMPO_CHAIN_IDS.TESTNET;
  }
  return chainId;
}

/**
 * Get network name from chain ID (for display purposes)
 */
export function getNetworkName(chainId?: number): Network {
  const id = chainId ?? getChainId();
  return id === TEMPO_CHAIN_IDS.MAINNET ? 'mainnet' : 'testnet';
}

/**
 * Check if current network is testnet
 */
export function isTestnet(): boolean {
  return getChainId() !== TEMPO_CHAIN_IDS.MAINNET;
}
