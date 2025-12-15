'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * BalanceDisplay - Client component for real-time balance polling
 *
 * Small client component: Only handles balance fetching and display.
 * Parent server component passes the wallet address.
 */

interface BalanceDisplayProps {
  walletAddress: string;
}

export function BalanceDisplay({ walletAddress }: BalanceDisplayProps) {
  const [balance, setBalance] = useState<number>(0.0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch(`/api/wallet/balance?address=${walletAddress}`);
      if (res.ok) {
        const data = await res.json();
        setBalance(Number.parseFloat(data.formattedBalance ?? '0'));
      }
    } catch (err) {
      console.error('Failed to fetch balance:', err);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchBalance();
    // Poll every 10 seconds for balance updates
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  return (
    <div className="flex items-baseline gap-2">
      {isLoading ? (
        <span className="text-4xl font-bold md:text-5xl text-muted-foreground animate-pulse">
          $---.--
        </span>
      ) : (
        <span className="text-4xl font-bold md:text-5xl">${balance.toFixed(2)}</span>
      )}
      <span className="text-lg text-muted-foreground ml-1">USDC</span>
    </div>
  );
}
