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

export const TEMPO_CHAIN_ID = 42429;

export const TEMPO_RPC_URL = process.env.TEMPO_RPC_URL ?? 'https://rpc.testnet.tempo.xyz';

export const TEMPO_EXPLORER_URL = 'https://explore.tempo.xyz';

/**
 * Well-known token addresses on Tempo Testnet
 *
 * PathUSD is the native fee token (always available for gas)
 * USDC is for bounty payments
 */
export const TEMPO_TOKENS = {
  // PathUSD - Native fee token, always available
  PATH_USD: '0x0000000000000000000000000000000000000001' as const,
  // USDC on Tempo Testnet - use this for bounty payments
  USDC: (process.env.TEMPO_USDC_ADDRESS ??
    '0x0000000000000000000000000000000000000002') as `0x${string}`,
} as const;

/**
 * BountyLane backend wallet addresses (Turnkey HSM-backed)
 *
 * These addresses are used for Access Key authorization (auto-signing).
 * The private keys are stored in Turnkey HSM and never exposed to BountyLane servers.
 *
 * Created via: pnpm tsx scripts/init-turnkey-wallets.ts
 * See docs/TURNKEY_SETUP.md for setup instructions
 */
export const BACKEND_WALLET_ADDRESSES = {
  testnet: '0xc8Da33c335231eC229A0251c77B3fb66EF216ab1' as `0x${string}`,
  mainnet: '0xb34132449fc504AF1bE82b02ef7Bba44DbB1328D' as `0x${string}`,
} as const;

/**
 * TIP-20 ABI for balance queries and transfers with memo
 *
 * TIP-20 extends ERC-20 with:
 * - transferWithMemo(to, amount, bytes32 memo) for payment references
 * - transferWithCommitment(to, amount, hash, locator) for off-chain data
 * - currency() returns "USD", "EUR", etc.
 */
export const TIP20_ABI = [
  // Standard ERC-20
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  // TIP-20 extensions
  {
    name: 'transferWithMemo',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'memo', type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'transferWithCommitment',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'commitmentHash', type: 'bytes32' },
      { name: 'locator', type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'currency',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
] as const;

/**
 * Generate explorer URL for a transaction
 */
export function getExplorerTxUrl(txHash: string): string {
  return `${TEMPO_EXPLORER_URL}/tx/${txHash}`;
}

/**
 * Generate explorer URL for an address
 */
export function getExplorerAddressUrl(address: string): string {
  return `${TEMPO_EXPLORER_URL}/address/${address}`;
}
