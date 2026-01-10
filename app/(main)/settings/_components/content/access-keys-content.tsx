'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import type { AccessKey } from '@/lib/auth/tempo-plugin/types';
import { Key } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { AccessKeyManager } from '../access-key-manager';
import { CreateAccessKeyInline } from '../create-access-key-inline';

// Default token for access key spending limits (alphaUSD on Moderato testnet)
const DEFAULT_LIMIT_TOKEN = '0x20c0000000000000000000000000000000000001' as `0x${string}`;

export interface AccessKeysContentProps {
  hasWallet: boolean;
  accessKeys: AccessKey[];
}

type ContentView = 'main' | 'create';

export function AccessKeysContent({
  hasWallet,
  accessKeys,
}: AccessKeysContentProps) {
  const [view, setView] = useState<ContentView>('main');
  const [keys, setKeys] = useState(accessKeys);

  if (!hasWallet) {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Access Keys</h1>
          <p className="text-muted-foreground">Manage auto-pay authorization for bounty payouts</p>
        </div>

        <Card>
          <CardContent className="py-12">
            <Empty>
              <EmptyMedia variant="icon">
                <Key />
              </EmptyMedia>
              <EmptyTitle>Wallet Required</EmptyTitle>
              <EmptyDescription>
                You need to create a wallet before you can set up access keys.{' '}
                <Link href="/settings/wallet" className="text-primary hover:underline">
                  Create wallet
                </Link>
              </EmptyDescription>
            </Empty>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Create view - replaces entire content including header
  if (view === 'create') {
    return (
      <div className="max-w-2xl">
        <CreateAccessKeyInline
          onSuccess={(newKey) => {
            setKeys([...keys, newKey]);
            setView('main');
          }}
          onBack={() => setView('main')}
          tokenAddress={DEFAULT_LIMIT_TOKEN}
        />
      </div>
    );
  }

  // Main view with header
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Access Keys</h1>
        <p className="text-muted-foreground">Manage auto-pay authorization for bounty payouts</p>
      </div>

      <AccessKeyManager
        keys={keys}
        onKeysChange={setKeys}
        onCreateClick={() => setView('create')}
      />
    </div>
  );
}
