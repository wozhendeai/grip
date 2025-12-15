import { http, createPublicClient, formatUnits } from 'viem';
import { TEMPO_CHAIN_ID, TEMPO_RPC_URL, TEMPO_TOKENS, TIP20_ABI } from './constants';

/**
 * Tempo public client for read-only RPC calls
 *
 * CRITICAL: Do NOT use eth_getBalance on Tempo - it returns a placeholder value.
 * Always use TIP-20 balanceOf() for balance checks.
 */
export const tempoPublicClient = createPublicClient({
  chain: {
    id: TEMPO_CHAIN_ID,
    name: 'Tempo Testnet',
    nativeCurrency: { name: 'USD', symbol: 'USD', decimals: 18 },
    rpcUrls: {
      default: { http: [TEMPO_RPC_URL] },
    },
  },
  transport: http(TEMPO_RPC_URL),
});

/**
 * Get TIP-20 token balance for an address
 *
 * @param address - Tempo address to check
 * @param tokenAddress - TIP-20 token contract address (defaults to USDC)
 * @returns Balance in smallest unit (wei-equivalent)
 */
export async function getTIP20Balance(
  address: `0x${string}`,
  tokenAddress: `0x${string}` = TEMPO_TOKENS.USDC
): Promise<bigint> {
  const balance = await tempoPublicClient.readContract({
    address: tokenAddress,
    abi: TIP20_ABI,
    functionName: 'balanceOf',
    args: [address],
  });

  return balance;
}

/**
 * Get TIP-20 token balance formatted with decimals
 *
 * @param address - Tempo address to check
 * @param tokenAddress - TIP-20 token contract address
 * @returns Balance as formatted string (e.g., "100.50")
 */
export async function getFormattedBalance(
  address: `0x${string}`,
  tokenAddress: `0x${string}` = TEMPO_TOKENS.USDC
): Promise<string> {
  const [balance, decimals] = await Promise.all([
    getTIP20Balance(address, tokenAddress),
    getTokenDecimals(tokenAddress),
  ]);

  return formatUnits(balance, decimals);
}

/**
 * Get token decimals
 */
export async function getTokenDecimals(tokenAddress: `0x${string}`): Promise<number> {
  const decimals = await tempoPublicClient.readContract({
    address: tokenAddress,
    abi: TIP20_ABI,
    functionName: 'decimals',
  });

  return decimals;
}

/**
 * Get token symbol
 */
export async function getTokenSymbol(tokenAddress: `0x${string}`): Promise<string> {
  const symbol = await tempoPublicClient.readContract({
    address: tokenAddress,
    abi: TIP20_ABI,
    functionName: 'symbol',
  });

  return symbol;
}

/**
 * Get complete token info (balance + metadata)
 */
export async function getTokenInfo(
  address: `0x${string}`,
  tokenAddress: `0x${string}` = TEMPO_TOKENS.USDC
): Promise<{
  balance: bigint;
  formattedBalance: string;
  decimals: number;
  symbol: string;
}> {
  const [balance, decimals, symbol] = await Promise.all([
    getTIP20Balance(address, tokenAddress),
    getTokenDecimals(tokenAddress),
    getTokenSymbol(tokenAddress),
  ]);

  return {
    balance,
    formattedBalance: formatUnits(balance, decimals),
    decimals,
    symbol,
  };
}
