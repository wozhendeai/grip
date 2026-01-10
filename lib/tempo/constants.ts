import { getChainId } from '@/lib/network';

/**
 * Tempo blockchain configuration
 *
 * Tempo is a Layer-1 blockchain for stablecoin payments.
 * Key differences from Ethereum:
 * - No native token (eth_getBalance returns placeholder, use TIP-20 balanceOf)
 * - Fees paid in USD stablecoins (any TIP-20 with currency="USD")
 * - Payment lane for guaranteed low-cost TIP-20 transfers
 * - Passkey (P256) authentication native support
 */

/** Tempo block explorer URL (same for testnet and mainnet) */
export const TEMPO_EXPLORER_URL = 'https://explore.tempo.xyz';

/** Official Tempo tokenlist for fee token selection and token discovery */
export function getTokenlistUrl(): string {
  return `https://tempoxyz.github.io/tempo-apps/${getChainId()}/tokenlist.json`;
}

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
