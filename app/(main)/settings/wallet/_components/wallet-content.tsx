'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePasskeys } from '@/lib/auth/auth-client';
import { useMemo } from 'react';
import { PasskeyManager } from '../../_components/passkey-manager';
import { type ActivityStats, StatsRow } from './stats-row';
import { WalletHero } from './wallet-hero';
import { WalletTabs } from './wallet-tabs';

interface Wallet {
  id: string;
  credentialID: string;
  name: string | null;
  tempoAddress: `0x${string}`;
  createdAt: string;
}

export interface WalletContentProps {
  stats: ActivityStats;
  isModal?: boolean;
}

export function WalletContent({ stats, isModal = false }: WalletContentProps) {
  // Use nanostore hook - auto-updates when passkeys are created/deleted
  const { data: passkeys, isPending: isLoading } = usePasskeys();

  // Derive wallet from passkeys data
  const wallet = useMemo<Wallet | null>(() => {
    if (!passkeys || passkeys.length === 0) return null;

    // Get the first passkey with an address (user's primary wallet)
    const passkey = passkeys.find((p) => p.tempoAddress);
    if (!passkey) return null;

    return {
      id: passkey.id,
      credentialID: passkey.credentialID,
      name: passkey.name,
      tempoAddress: passkey.tempoAddress as `0x${string}`,
      createdAt: passkey.createdAt ?? new Date().toISOString(),
    };
  }, [passkeys]);

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-6">
        {!isModal && (
          <div>
            <h1 className="text-2xl font-bold">Wallet</h1>
            <p className="text-muted-foreground">Manage your Tempo wallet and passkey settings</p>
          </div>
        )}
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  // No wallet - show passkey creation
  if (!wallet?.tempoAddress) {
    return (
      <div className="max-w-2xl space-y-6">
        {!isModal && (
          <div>
            <h1 className="text-2xl font-bold">Wallet</h1>
            <p className="text-muted-foreground">Manage your Tempo wallet and passkey settings</p>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Create Your Wallet</CardTitle>
            <CardDescription>
              Your wallet is secured by a passkey (TouchID, FaceID, or security key)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PasskeyManager wallet={wallet} />
          </CardContent>
        </Card>
      </div>
    );
  }

  const walletWithAddress = {
    id: wallet.id,
    credentialID: wallet.credentialID,
    name: wallet.name,
    tempoAddress: wallet.tempoAddress,
    createdAt: wallet.createdAt,
  };

  // Modal mode - compact layout
  if (isModal) {
    return (
      <div className="space-y-4">
        <WalletHero wallet={walletWithAddress} isModal />
        <StatsRow stats={stats} isModal />
        <WalletTabs isModal />
      </div>
    );
  }

  // Full page mode
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Wallet</h1>
        <p className="text-muted-foreground">Manage your Tempo wallet and funds</p>
      </div>

      <WalletHero wallet={walletWithAddress} />
      <StatsRow stats={stats} />
      <WalletTabs />
    </div>
  );
}
