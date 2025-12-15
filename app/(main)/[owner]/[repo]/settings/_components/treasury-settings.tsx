'use client';

import { AddressDisplay } from '@/components/tempo/address-display';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface TreasurySettingsProps {
  githubRepoId: number;
}

interface TreasuryInfo {
  configured: boolean;
  address?: string;
  balance?: {
    formatted: string;
    symbol: string;
  } | null;
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
export function TreasurySettings({ githubRepoId }: TreasurySettingsProps) {
  const [treasuryInfo, setTreasuryInfo] = useState<TreasuryInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTreasuryInfo = useCallback(async () => {
    try {
      const res = await fetch(`/api/repo-settings/${githubRepoId}/treasury`);
      if (res.ok) {
        const data = await res.json();
        setTreasuryInfo(data);
      }
    } catch (err) {
      console.error('Failed to fetch treasury info:', err);
    } finally {
      setIsLoading(false);
    }
  }, [githubRepoId]);

  useEffect(() => {
    fetchTreasuryInfo();
  }, [fetchTreasuryInfo]);

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

  // Treasury is configured - show status and balance
  if (treasuryInfo?.configured && treasuryInfo.address) {
    return (
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
          {treasuryInfo.balance ? (
            <div className="rounded-lg border border-border bg-card/50 p-6">
              <p className="text-sm text-muted-foreground mb-1">Treasury Balance</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">
                  ${treasuryInfo.balance.formatted ?? '0.00'}
                </span>
                <span className="text-lg text-muted-foreground">
                  {treasuryInfo.balance.symbol ?? 'USDC'}
                </span>
              </div>
            </div>
          ) : treasuryInfo.error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{treasuryInfo.error}</p>
            </div>
          ) : null}

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

        <Button render={<Link href="/wallet" />}>Create Passkey</Button>
      </CardContent>
    </Card>
  );
}
