'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getTokenlistUrl } from '@/lib/tempo/constants';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatUnits, getAddress } from 'viem';
import { Hooks } from 'wagmi/tempo';

export interface Token {
  address: `0x${string}`;
  symbol: string;
  name: string;
  logoURI: string;
  decimals: number;
}

interface TokenSelectProps {
  /** Current selected token address */
  value?: `0x${string}` | null;
  /** Called when selection changes (controlled mode) */
  onChange?: (token: Token | null) => void;
  /** Called when a token is selected (callback mode, e.g., to trigger a mutation) */
  onSelect?: (token: Token) => void | Promise<void>;
  /** Wallet address to show balances for (optional) */
  walletAddress?: `0x${string}`;
  /** Whether to show token balances */
  showBalances?: boolean;
  /** Placeholder text when no token selected */
  placeholder?: string;
  /** Disable the select */
  disabled?: boolean;
  /** Additional class name for trigger */
  className?: string;
  /** Label shown before the select */
  label?: string;
}

/**
 * Token selector component for TIP-20 tokens on Tempo
 *
 * Fetches available tokens from the Tempo tokenlist and displays them
 * with optional balance information. Supports both controlled (value/onChange)
 * and callback (onSelect) modes.
 *
 * Usage:
 * ```tsx
 * // Controlled mode for forms
 * <TokenSelect
 *   value={selectedToken}
 *   onChange={(token) => setSelectedToken(token?.address)}
 *   showBalances
 *   walletAddress={userAddress}
 * />
 *
 * // Callback mode for mutations (e.g., setting fee token)
 * <TokenSelect
 *   value={currentFeeToken}
 *   onSelect={async (token) => await setFeeToken({ token: token.address })}
 *   walletAddress={userAddress}
 *   showBalances
 * />
 * ```
 */
export function TokenSelect({
  value,
  onChange,
  onSelect,
  walletAddress,
  showBalances = false,
  placeholder = 'Select token',
  disabled = false,
  className,
  label,
}: TokenSelectProps) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(true);
  const [isSelecting, setIsSelecting] = useState(false);

  // Fetch tokenlist on mount
  useEffect(() => {
    async function fetchTokens() {
      try {
        const res = await fetch(getTokenlistUrl());
        const data = await res.json();
        setTokens(
          data.tokens.map(
            (t: {
              address: string;
              symbol: string;
              name: string;
              logoURI: string;
              decimals: number;
            }) => ({
              address: getAddress(t.address),
              symbol: t.symbol,
              name: t.name,
              logoURI: t.logoURI,
              decimals: t.decimals,
            })
          )
        );
      } catch (err) {
        console.error('Failed to fetch tokenlist:', err);
      } finally {
        setIsLoadingTokens(false);
      }
    }
    fetchTokens();
  }, []);

  const handleChange = async (tokenAddress: string) => {
    const token = tokens.find((t) => t.address === tokenAddress);
    if (!token) return;

    // Controlled mode
    onChange?.(token);

    // Callback mode (e.g., trigger mutation)
    if (onSelect) {
      setIsSelecting(true);
      try {
        await onSelect(token);
      } catch (err) {
        console.error('Token selection failed:', err);
      } finally {
        setIsSelecting(false);
      }
    }
  };

  const currentToken = tokens.find((t) => t.address.toLowerCase() === value?.toLowerCase());

  const isBusy = isSelecting || disabled;

  if (isLoadingTokens) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        <span>Loading tokens...</span>
      </div>
    );
  }

  const handleValueChange = (newValue: string | null) => {
    if (newValue) {
      handleChange(newValue);
    }
  };

  return (
    <div className={cn('flex items-center gap-2', label && 'flex-col items-start gap-1')}>
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
      <div className="flex items-center gap-2">
        <Select value={value ?? ''} onValueChange={handleValueChange} disabled={isBusy}>
          <SelectTrigger className={cn('w-auto min-w-[160px]', className)}>
            <SelectValue>
              {currentToken ? (
                <span className="flex items-center gap-2">
                  <img
                    src={currentToken.logoURI}
                    alt={currentToken.symbol}
                    className="size-5 rounded-full"
                  />
                  {currentToken.symbol}
                </span>
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="start">
            {tokens.map((token) => (
              <TokenOption
                key={token.address}
                token={token}
                walletAddress={walletAddress}
                showBalance={showBalances}
              />
            ))}
          </SelectContent>
        </Select>
        {isSelecting && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>
    </div>
  );
}

/**
 * Individual token option with optional balance display
 */
function TokenOption({
  token,
  walletAddress,
  showBalance,
}: {
  token: Token;
  walletAddress?: `0x${string}`;
  showBalance: boolean;
}) {
  // Only fetch balance if showing balances and wallet provided
  const { data: balance, isLoading } = Hooks.token.useGetBalance({
    account: walletAddress ?? '0x0000000000000000000000000000000000000000',
    token: token.address,
    query: {
      enabled: showBalance && Boolean(walletAddress),
    },
  });

  const formattedBalance = balance ? formatUnits(balance, token.decimals) : '0';

  return (
    <SelectItem value={token.address}>
      <div className="flex items-center justify-between gap-4 w-full">
        <span className="flex items-center gap-2">
          <img src={token.logoURI} alt={token.symbol} className="size-5 rounded-full" />
          <span>{token.symbol}</span>
        </span>
        {showBalance && walletAddress && (
          <span className="text-muted-foreground text-sm">
            {isLoading ? '...' : `$${Number(formattedBalance).toFixed(2)}`}
          </span>
        )}
      </div>
    </SelectItem>
  );
}

/**
 * Hook to get tokens from the Tempo tokenlist
 * Useful when you need token data outside of TokenSelect
 */
export function useTokenList() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchTokens() {
      try {
        const res = await fetch(getTokenlistUrl());
        const data = await res.json();
        setTokens(
          data.tokens.map(
            (t: {
              address: string;
              symbol: string;
              name: string;
              logoURI: string;
              decimals: number;
            }) => ({
              address: getAddress(t.address),
              symbol: t.symbol,
              name: t.name,
              logoURI: t.logoURI,
              decimals: t.decimals,
            })
          )
        );
      } catch (err) {
        console.error('Failed to fetch tokenlist:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchTokens();
  }, []);

  return { tokens, isLoading };
}
