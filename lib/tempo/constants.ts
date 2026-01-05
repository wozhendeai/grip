import { tempo } from 'tempo.ts/chains';

/**
 * Tempo blockchain configuration
 *
 * Tempo is a Layer-1 blockchain for stablecoin payments.
 * Key differences from Ethereum:
 * - No native token (eth_getBalance returns placeholder, use TIP-20 balanceOf)
 * - Fees paid in USD stablecoins (any TIP-20 with currency="USD")
 * - Payment lane for guaranteed low-cost TIP-20 transfers
 * - Passkey (P256) authentication native support
 *
 * Note: We use the tempo.ts SDK for most operations, but these constants are
 * still needed for manual operations and app-specific configuration.
 */

export const TEMPO_CHAIN_ID = 42429;

export const TEMPO_RPC_URL = process.env.TEMPO_RPC_URL ?? tempo().rpcUrls.default.http[0];

export const TEMPO_EXPLORER_URL = 'https://explore.tempo.xyz';

/**
 * Tempo System Contracts (Predeployed)
 *
 * Core protocol contracts that power Tempo's features.
 * See: https://docs.tempo.xyz/protocol
 */
export const TEMPO_CONTRACTS = {
  /** TIP-20 Factory - Create new TIP-20 tokens */
  TIP20_FACTORY: '0x20fc000000000000000000000000000000000000' as const,
  /** Fee Manager - Handle fee payments and conversions */
  FEE_MANAGER: '0xfeec000000000000000000000000000000000000' as const,
  /** Stablecoin DEX - Enshrined DEX for stablecoin swaps */
  STABLECOIN_DEX: '0xdec0000000000000000000000000000000000000' as const,
  /** TIP-403 Registry - Transfer policy registry */
  TIP403_REGISTRY: '0x403c000000000000000000000000000000000000' as const,
  /** PathUSD - First stablecoin deployed on Tempo */
  PATH_USD: '0x20c0000000000000000000000000000000000000' as const,
} as const;

/**
 * Well-known token addresses on Tempo
 *
 * USDC is used for bounty payments and balance display.
 * Fee tokens are handled by user preference with protocol fallback to pathUSD.
 */
const TEMPO_USDC_ADDRESS =
  process.env.TEMPO_USDC_ADDRESS ?? '0x20c0000000000000000000000000000000000001';

export const TEMPO_TOKENS = {
  /** USDC on Tempo - use this for bounty payments and balance display */
  USDC: TEMPO_USDC_ADDRESS as `0x${string}`,
} as const;

/**
 * GRIP backend wallet addresses (Turnkey HSM-backed)
 *
 * These addresses are used for Access Key authorization (auto-signing).
 * The private keys are stored in Turnkey HSM and never exposed to GRIP servers.
 *
 * Created via: pnpm tsx scripts/init-turnkey-wallets.ts
 * See docs/TURNKEY_SETUP.md for setup instructions
 */
export const BACKEND_WALLET_ADDRESSES = {
  testnet: '0xc8Da33c335231eC229A0251c77B3fb66EF216ab1' as `0x${string}`,
  mainnet: '0xb34132449fc504AF1bE82b02ef7Bba44DbB1328D' as `0x${string}`,
} as const;

/**
 * Generate explorer URL for a transaction
 */
export function getExplorerTxUrl(txHash: string): string {
  return `${TEMPO_EXPLORER_URL}/tx/${txHash}`;
}
