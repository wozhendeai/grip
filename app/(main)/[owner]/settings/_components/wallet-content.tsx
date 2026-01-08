'use client';

import { AddressDisplay } from '@/components/tempo/address-display';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TEMPO_TOKENS } from '@/lib/tempo/constants';
import { ExternalLink, HelpCircle, Loader2, Wallet } from 'lucide-react';
import { formatUnits } from 'viem';
import { Hooks } from 'wagmi/tempo';

interface WalletContentProps {
  walletAddress: `0x${string}` | null;
}

export function WalletContent({ walletAddress }: WalletContentProps) {
  const isTestnet = process.env.NEXT_PUBLIC_TEMPO_NETWORK === 'testnet';
  const explorerUrl = isTestnet ? 'https://explore.testnet.tempo.xyz' : 'https://explore.tempo.xyz';

  // Use SDK hook for balance - auto-refreshes every 15s
  const { data: rawBalance, isLoading: isLoadingBalance } = Hooks.token.useGetBalance({
    account: walletAddress ?? '0x0000000000000000000000000000000000000000',
    token: TEMPO_TOKENS.USDC as `0x${string}`,
    query: {
      enabled: Boolean(walletAddress),
      refetchInterval: 15_000,
      staleTime: 15_000,
    },
  });

  const balance = rawBalance ? Number(formatUnits(rawBalance, 6)) : 0;

  // No wallet address available
  if (!walletAddress) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Organization Wallet</CardTitle>
          <CardDescription>View the organization&apos;s treasury</CardDescription>
        </CardHeader>
        <CardContent>
          <Empty className="py-8">
            <EmptyMedia variant="icon">
              <Wallet />
            </EmptyMedia>
            <EmptyTitle>No Wallet Available</EmptyTitle>
            <EmptyDescription>
              The organization owner needs to create a passkey wallet first.
            </EmptyDescription>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Organization Wallet</CardTitle>
            <Popover>
              <PopoverTrigger className="text-muted-foreground hover:text-foreground transition-colors">
                <HelpCircle className="size-4" />
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-2">
                  <p className="font-medium text-sm">About Organization Wallets</p>
                  <p className="text-sm text-muted-foreground">
                    This wallet is controlled by the organization owner&apos;s passkey. Team members
                    can spend from this wallet using Access Keys, which provide delegated spending
                    authority with configurable limits.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    To fund this wallet, the organization owner can send USDC to the address shown.
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <CardDescription>View the organization&apos;s treasury balance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Balance Display */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Balance</p>
              <div className="flex items-baseline gap-2">
                {isLoadingBalance ? (
                  <span className="text-3xl font-bold text-muted-foreground animate-pulse">
                    $---.--
                  </span>
                ) : (
                  <span className="text-3xl font-bold">${balance.toFixed(2)}</span>
                )}
                <span className="text-sm text-muted-foreground">USDC</span>
              </div>
            </div>
            {isLoadingBalance && <Loader2 className="size-5 animate-spin text-muted-foreground" />}
          </div>

          {/* Address */}
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-2">Wallet Address</p>
            <div className="flex items-center gap-3">
              <AddressDisplay address={walletAddress} truncate={false} />
              <a
                href={`${explorerUrl}/address/${walletAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                View on Explorer
                <ExternalLink className="size-3" />
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
