'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Key, Shield } from 'lucide-react';
import { useState } from 'react';
import { CreateAccessKeyModal } from './create-access-key-modal';

type AccessKey = {
  id: string;
  backendWalletAddress: string;
  limits: Record<string, { initial: string; remaining: string }>;
  status: string;
  createdAt: string | null;
  lastUsedAt: string | null;
  label: string | null;
  expiry: number | null;
};

type AccessKeyManagerProps = {
  initialKeys: AccessKey[];
  credentialId: string;
};

export function AccessKeyManager({ initialKeys, credentialId }: AccessKeyManagerProps) {
  const [keys, setKeys] = useState(initialKeys);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  async function handleRevoke(keyId: string) {
    if (
      !confirm(
        'Are you sure you want to revoke this Access Key? Future bounty payouts will require manual signing.'
      )
    ) {
      return;
    }

    try {
      setRevoking(keyId);

      const res = await fetch(`/api/access-keys/${keyId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'User revoked from settings',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to revoke Access Key');
      }

      const { accessKey } = await res.json();

      // Update local state
      setKeys(keys.map((k) => (k.id === keyId ? accessKey : k)));
    } catch (err) {
      console.error('Revoke error:', err);
      alert(err instanceof Error ? err.message : 'Failed to revoke Access Key');
    } finally {
      setRevoking(null);
    }
  }

  function handleCreateSuccess(newKey: AccessKey) {
    setKeys([...keys, newKey]);
  }

  const activeKeys = keys.filter((k) => k.status === 'active');
  const revokedKeys = keys.filter((k) => k.status === 'revoked');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle>Auto-Pay Authorization</CardTitle>
            </div>
            <CardDescription>
              Grant BountyLane permission to automatically sign bounty payouts on your behalf
            </CardDescription>
          </div>
          {activeKeys.length === 0 && (
            <Button onClick={() => setShowCreateModal(true)} size="sm">
              Enable Auto-Pay
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {keys.length === 0 ? (
          <EmptyState onCreateClick={() => setShowCreateModal(true)} />
        ) : (
          <>
            {activeKeys.length > 0 && (
              <div className="space-y-4">
                <h3 className="heading-4">Active Keys</h3>
                <div className="space-y-3">
                  {activeKeys.map((key) => (
                    <AccessKeyListItem
                      key={key.id}
                      accessKey={key}
                      onRevoke={handleRevoke}
                      revoking={revoking === key.id}
                    />
                  ))}
                </div>
              </div>
            )}

            {revokedKeys.length > 0 && (
              <div className="space-y-4">
                <h3 className="heading-4 text-muted-foreground">Revoked Keys</h3>
                <div className="space-y-3">
                  {revokedKeys.map((key) => (
                    <AccessKeyListItem
                      key={key.id}
                      accessKey={key}
                      onRevoke={handleRevoke}
                      revoking={false}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {showCreateModal && (
          <CreateAccessKeyModal
            open={showCreateModal}
            onOpenChange={setShowCreateModal}
            onSuccess={handleCreateSuccess}
            credentialId={credentialId}
          />
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="text-center py-12 space-y-4">
      <div className="flex justify-center">
        <div className="rounded-full bg-muted p-4">
          <Key className="h-8 w-8 text-muted-foreground" />
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="heading-3">No Access Keys</h3>
        <p className="body-sm text-muted-foreground max-w-sm mx-auto">
          Enable Auto-Pay to automatically sign bounty payouts without manual approval each time
        </p>
      </div>
      <Button onClick={onCreateClick}>Enable Auto-Pay</Button>
    </div>
  );
}

function AccessKeyListItem({
  accessKey,
  onRevoke,
  revoking,
}: {
  accessKey: AccessKey;
  onRevoke: (id: string) => void;
  revoking: boolean;
}) {
  const isActive = accessKey.status === 'active';
  const isExpired = accessKey.expiry && Date.now() / 1000 > accessKey.expiry;

  // Get spending limit from limits object
  const limitEntries = Object.entries(accessKey.limits);
  const totalLimit =
    limitEntries.length > 0
      ? (BigInt(limitEntries[0][1].initial) / BigInt(1_000_000)).toString()
      : '0';
  const remainingLimit =
    limitEntries.length > 0
      ? (BigInt(limitEntries[0][1].remaining) / BigInt(1_000_000)).toString()
      : '0';

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <p className="body-base font-medium">{accessKey.label || 'Auto-Pay Access Key'}</p>
            {isActive && !isExpired && (
              <Badge variant="default" className="bg-primary">
                Active
              </Badge>
            )}
            {isExpired && <Badge variant="secondary">Expired</Badge>}
            {accessKey.status === 'revoked' && <Badge variant="secondary">Revoked</Badge>}
          </div>
          <p className="caption text-muted-foreground font-mono">
            {truncateAddress(accessKey.backendWalletAddress)}
          </p>
        </div>

        {isActive && !isExpired && (
          <Button
            onClick={() => onRevoke(accessKey.id)}
            variant="outline"
            size="sm"
            disabled={revoking}
          >
            {revoking ? 'Revoking...' : 'Revoke'}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="caption text-muted-foreground">Spending Limit</p>
          <p className="body-sm font-medium">${totalLimit} USDC</p>
        </div>
        <div>
          <p className="caption text-muted-foreground">Remaining</p>
          <p className="body-sm font-medium">${remainingLimit} USDC</p>
        </div>
      </div>

      {accessKey.lastUsedAt && (
        <div className="pt-2 border-t">
          <p className="caption text-muted-foreground">
            Last used: {new Date(accessKey.lastUsedAt).toLocaleDateString()}
          </p>
        </div>
      )}

      {isExpired && (
        <div className="flex items-start gap-2 p-3 bg-muted rounded">
          <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
          <p className="caption text-muted-foreground">
            This Access Key has expired. Create a new one to enable Auto-Pay.
          </p>
        </div>
      )}
    </div>
  );
}

function truncateAddress(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
