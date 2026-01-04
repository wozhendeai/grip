'use client';

import { AccessKeyManager } from '@/app/(main)/settings/_components/access-key-manager';
import { AddressDisplay } from '@/components/tempo/address-display';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, Key, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface TreasurySettingsProps {
  githubRepoId: number;
}

interface TreasuryInfo {
  configured: boolean;
  address?: string;
  credentialId?: string;
  balance?: {
    formatted: string;
    symbol: string;
  } | null;
  committed?: {
    formatted: string;
  } | null;
  message?: string;
  error?: string;
}

type AccessKey = {
  id: string;
  backendWalletAddress: string | null;
  limits: Record<string, { initial: string; remaining: string }>;
  status: string;
  createdAt: string | null;
  lastUsedAt: string | null;
  label: string | null;
  expiry: number | null;
};

/**
 * Treasury settings component
 *
 * In the new model, repo treasury = repo owner's wallet (first passkey).
 * This component displays the treasury status and balance.
 * No separate treasury setup needed - it's auto-configured via owner's passkey.
 */
export function TreasurySettings({ githubRepoId }: TreasurySettingsProps) {
  const [treasuryInfo, setTreasuryInfo] = useState<TreasuryInfo | null>(null);
  const [accessKeys, setAccessKeys] = useState<AccessKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      // Fetch treasury info and access keys in parallel
      const [treasuryRes, accessKeysRes] = await Promise.all([
        fetch(`/api/repo-settings/${githubRepoId}/treasury`),
        fetch('/api/auth/tempo/access-keys'),
      ]);

      if (treasuryRes.ok) {
        const data = await treasuryRes.json();
        setTreasuryInfo(data);
      }

      if (accessKeysRes.ok) {
        const data = await accessKeysRes.json();
        setAccessKeys(data.accessKeys ?? []);
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
            {treasuryInfo.balance ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-card/50 p-4">
                  <p className="text-sm text-muted-foreground mb-1">Balance</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold">
                      ${treasuryInfo.balance.formatted ?? '0.00'}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {treasuryInfo.balance.symbol ?? 'USDC'}
                    </span>
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-card/50 p-4">
                  <p className="text-sm text-muted-foreground mb-1">Committed</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold">
                      ${treasuryInfo.committed?.formatted ?? '0.00'}
                    </span>
                    <span className="text-sm text-muted-foreground">USDC</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Open bounties</p>
                </div>
                <div className="rounded-lg border border-border bg-card/50 p-4">
                  <p className="text-sm text-muted-foreground mb-1">Available</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold">
                      $
                      {(
                        Number(treasuryInfo.balance.formatted ?? 0) -
                        Number(treasuryInfo.committed?.formatted ?? 0)
                      ).toFixed(2)}
                    </span>
                    <span className="text-sm text-muted-foreground">USDC</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">For new bounties</p>
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

        {/* Access Keys Section */}
        {treasuryInfo.credentialId && (
          <div className="mt-6">
            <AccessKeyManager initialKeys={accessKeys} credentialId={treasuryInfo.credentialId} />
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

        <Button nativeButton={false} render={<Link href="/wallet" />}>
          Create Passkey
        </Button>
      </CardContent>
    </Card>
  );
}
