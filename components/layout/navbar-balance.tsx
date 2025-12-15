'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

/**
 * NavbarBalance - Client component for navbar balance display
 *
 * Mirrors BalanceDisplay from /wallet page but adapted for navbar:
 * - Fetches from /api/wallet/balance
 * - Polls every 10 seconds
 * - Shows skeleton during loading to prevent layout shift
 * - Links to /wallet page on click
 */

interface NavbarBalanceProps {
  walletAddress: string;
}

export function NavbarBalance({ walletAddress }: NavbarBalanceProps) {
  const [balance, setBalance] = useState<number | null>(null);
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
    const interval = setInterval(fetchBalance, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, [fetchBalance]);

  return (
    <Link
      href="/wallet"
      className="hidden sm:flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <span className="font-medium">
        {isLoading ? '$---.--' : `$${balance?.toFixed(2) ?? '0.00'}`}
      </span>
    </Link>
  );
}
