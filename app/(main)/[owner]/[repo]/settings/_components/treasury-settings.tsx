'use client';

import { AccessKeyManager } from '@/app/(main)/settings/_components/access-key-manager';
import { CreateAccessKeyInline } from '@/app/(main)/settings/_components/create-access-key-inline';
import { PayoutQueue } from '@/app/(main)/[owner]/[repo]/_components/payout-queue';
import { AddressDisplay } from '@/components/tempo/address-display';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authClient } from '@/lib/auth/auth-client';
import type { AccessKey } from '@/lib/auth/tempo-plugin/types';
import { ExternalLink, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { formatUnits } from 'viem';
import { Hooks } from 'wagmi/tempo';

interface TreasurySettingsProps {
  githubRepoId: number;
}

interface TreasuryInfo {
  configured: boolean;
  address?: string;
  committed?: {
    formatted: string;
  } | null;
  tokenAddress?: string;
  tokenDecimals?: number;
  tokenSymbol?: string;
  message?: string;
  error?: string;
}

/**
 * Treasury settings component
 *
 * In the new model, repo treasury = repo owner's wallet (first passkey).
 * This component displays the treasury status and balance.
 * No separate treasury setup needed - it's auto-configured via owner's passkey.
 */
type AccessKeyView = 'main' | 'create';

export function TreasurySettings({ githubRepoId }: TreasurySettingsProps) {
  const [treasuryInfo, setTreasuryInfo] = useState<TreasuryInfo | null>(null);
  const [accessKeys, setAccessKeys] = useState<AccessKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [accessKeyView, setAccessKeyView] = useState<AccessKeyView>('main');

  const balanceAccount = (treasuryInfo?.address ??
    '0x0000000000000000000000000000000000000000') as `0x${string}`;
  const tokenAddress = treasuryInfo?.tokenAddress as `0x${string}` | undefined;
  const hasToken = Boolean(tokenAddress);
  const tokenDecimals = treasuryInfo?.tokenDecimals ?? 6;

  const { data: balance, isLoading: isBalanceLoading } = Hooks.token.useGetBalance({
    account: balanceAccount,
    token: tokenAddress ?? '0x0000000000000000000000000000000000000000',
    query: {
      enabled: Boolean(treasuryInfo?.address) && hasToken,
      refetchInterval: 10_000,
      staleTime: 10_000,
    },
  });
  const { data: metadata, isLoading: isMetadataLoading } = Hooks.token.useGetMetadata({
    token: tokenAddress ?? '0x0000000000000000000000000000000000000000',
    query: {
      enabled: hasToken,
      staleTime: 86_400_000,
    },
  });

  const decimals = metadata?.decimals ?? tokenDecimals;
  const displaySymbol = metadata?.symbol ?? treasuryInfo?.tokenSymbol;
  const formattedBalance = balance ? formatUnits(balance, decimals) : null;
  const isBalanceLoadingCombined = isBalanceLoading || isMetadataLoading;
  const balanceNumber = formattedBalance ? Number.parseFloat(formattedBalance) : 0;
  const committedNumber = Number.parseFloat(treasuryInfo?.committed?.formatted ?? '0');
  const availableNumber = balanceNumber - committedNumber;

  const fetchData = useCallback(async () => {
    try {
      // Fetch treasury info and access keys in parallel
      const [treasuryRes, accessKeysResult] = await Promise.all([
        fetch(`/api/repo-settings/${githubRepoId}/treasury`),
        authClient.listAccessKeys(),
      ]);

      if (treasuryRes.ok) {
        const data = await treasuryRes.json();
        setTreasuryInfo(data);
      }

      if (accessKeysResult.data) {
        setAccessKeys(accessKeysResult.data.accessKeys ?? []);
      }
    } catch (err) {
      console.error('Failed to fetch treasury info:', err);
    } finally {
      setIsLoading(false);
    }
  }, [githubRepoId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Treasury Wallet</CardTitle>
          <CardDescription>Loading treasury information...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-12 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Treasury is configured - show status, balance, and Access Keys
  if (treasuryInfo?.configured && treasuryInfo.address) {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Treasury Wallet
            </CardTitle>
            <CardDescription>
              Your repo treasury uses your personal wallet. Fund this address to pay bounties.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Balance Display */}
            {treasuryInfo.error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                <p className="text-sm text-destructive">{treasuryInfo.error}</p>
              </div>
            ) : !hasToken ? (
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">
                  Set a fee token in your{' '}
                  <Link href="/settings/wallet" className="text-primary hover:underline">
                    wallet settings
                  </Link>{' '}
                  to view balance and create access keys.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-card/50 p-4">
                  <p className="text-sm text-muted-foreground mb-1">Balance</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold">
                      {isBalanceLoadingCombined ? '$---.--' : `$${balanceNumber.toFixed(2)}`}
                    </span>
                    <span className="text-sm text-muted-foreground">{displaySymbol}</span>
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-card/50 p-4">
                  <p className="text-sm text-muted-foreground mb-1">Committed</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold">
                      ${treasuryInfo.committed?.formatted ?? '0.00'}
                    </span>
                    <span className="text-sm text-muted-foreground">{displaySymbol}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Open bounties</p>
                </div>
                <div className="rounded-lg border border-border bg-card/50 p-4">
                  <p className="text-sm text-muted-foreground mb-1">Available</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold">
                      {isBalanceLoadingCombined ? '$---.--' : `$${availableNumber.toFixed(2)}`}
                    </span>
                    <span className="text-sm text-muted-foreground">{displaySymbol}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">For new bounties</p>
                </div>
              </div>
            )}

            {/* Address Display */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">Treasury Address</p>
              <AddressDisplay address={treasuryInfo.address} truncate={false} />
              <p className="text-xs text-muted-foreground mt-2">
                Send USDC to this address to fund bounties.
              </p>
            </div>

            {/* Explorer Link */}
            <a
              href={`https://explore.tempo.xyz/address/${treasuryInfo.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View on Explorer
              <ExternalLink className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>

        {/* Pending Payouts Section */}
        <div className="mt-6">
          <PayoutQueue githubRepoId={githubRepoId} />
        </div>

        {/* Access Keys Section - only show if fee token is set */}
        {treasuryInfo.address && hasToken && tokenAddress && (
          <div className="mt-6">
            {accessKeyView === 'create' ? (
              <CreateAccessKeyInline
                onSuccess={(newKey) => {
                  setAccessKeys([...accessKeys, newKey]);
                  setAccessKeyView('main');
                }}
                onBack={() => setAccessKeyView('main')}
                tokenAddress={tokenAddress}
              />
            ) : (
              <AccessKeyManager
                keys={accessKeys}
                onKeysChange={setAccessKeys}
                onCreateClick={() => setAccessKeyView('create')}
              />
            )}
          </div>
        )}
      </>
    );
  }

  // Treasury not configured - owner needs to create a passkey
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Treasury Wallet
        </CardTitle>
        <CardDescription>Create a passkey to manage your repo treasury.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Setup Instructions */}
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <h4 className="font-medium mb-2">How it works</h4>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-primary">1.</span>
              Your treasury uses your personal wallet (passkey)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">2.</span>
              Create a passkey to generate a Tempo blockchain address
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">3.</span>
              Fund the address with USDC to pay contributors
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">4.</span>
              Approve bounties and sign payments with your passkey
            </li>
          </ul>
        </div>

        <Button nativeButton={false} render={<Link href="/settings/wallet" />}>
          Create Passkey
        </Button>
      </CardContent>
    </Card>
  );
}
