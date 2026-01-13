'use client';

import { Hooks } from 'wagmi/tempo';

interface TokenSymbolProps {
  tokenAddress: `0x${string}`;
  fallback?: string;
  className?: string;
}

/**
 * Displays the symbol for a token address
 *
 * Fetches token metadata from the SDK and displays the symbol.
 * Uses a fallback while loading or on error.
 */
export function TokenSymbol({ tokenAddress, fallback = 'USDC', className }: TokenSymbolProps) {
  const { data: metadata, isLoading } = Hooks.token.useGetMetadata({
    token: tokenAddress,
    query: { enabled: true },
  });

  if (isLoading) {
    return <span className={className}>{fallback}</span>;
  }

  return <span className={className}>{metadata?.symbol ?? fallback}</span>;
}
