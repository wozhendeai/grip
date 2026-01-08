import 'server-only';

import { tempoClient } from './client';

interface TokenMetadata {
  decimals: number;
  symbol: string;
  name: string;
}

/**
 * In-memory cache for token metadata.
 * Refreshes on server restart - acceptable since token metadata rarely changes.
 */
const metadataCache = new Map<string, TokenMetadata>();

/**
 * Fetch token metadata from the Tempo SDK.
 *
 * Uses in-memory caching to avoid repeated RPC calls for the same token.
 * For multi-token support, call this with any TIP-20 token address.
 */
export async function getTokenMetadata(tokenAddress: `0x${string}`): Promise<TokenMetadata> {
  const cacheKey = tokenAddress.toLowerCase();

  const cached = metadataCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const metadata = await tempoClient.token.getMetadata({ token: tokenAddress });
  const result: TokenMetadata = {
    decimals: metadata.decimals,
    symbol: metadata.symbol,
    name: metadata.name,
  };

  metadataCache.set(cacheKey, result);
  return result;
}
