import { tempoTestnet } from 'viem/chains';

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
 * Chain config (id, rpcUrls, blockExplorers) comes from viem/chains.
 */

/** Re-export for convenience - prefer importing directly from viem/chains */
export { tempoTestnet };

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

/** Official Tempo tokenlist for fee token selection and token discovery */
export const TEMPO_TOKENLIST_URL = 'https://tempoxyz.github.io/tempo-apps/42429/tokenlist.json';

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
  const explorerUrl = tempoTestnet.blockExplorers?.default.url ?? 'https://explore.tempo.xyz';
  return `${explorerUrl}/tx/${txHash}`;
}
