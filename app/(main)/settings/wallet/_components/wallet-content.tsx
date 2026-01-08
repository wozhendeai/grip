'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PasskeyManager } from '../../_components/passkey-manager';
import { type ActivityStats, StatsRow } from './stats-row';
import { WalletHero } from './wallet-hero';
import { WalletTabs } from './wallet-tabs';

export interface WalletContentProps {
  wallet: {
    id: string;
    name: string | null;
    tempoAddress: `0x${string}`;
    createdAt: string;
  } | null;
  stats: ActivityStats;
  isModal?: boolean;
}

export function WalletContent({ wallet, stats, isModal = false }: WalletContentProps) {
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
