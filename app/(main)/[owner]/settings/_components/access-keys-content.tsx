'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatTimeAgo } from '@/lib/utils';
import { ExternalLink, HelpCircle, Key, Plus, User } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import type { OrgAccessKey, OrgMember } from '../_lib/types';
import { CreateOrgAccessKeyModal } from './create-org-access-key-modal';

// Default token for access key spending limits (alphaUSD on Moderato testnet)
const DEFAULT_LIMIT_TOKEN = '0x20c0000000000000000000000000000000000001' as `0x${string}`;

interface AccessKeysContentProps {
  ownerHasAccessKey: boolean;
  orgAccessKeys: OrgAccessKey[];
  members: OrgMember[];
  organizationId: string;
}

/**
 * Access Keys content for org settings
 *
 * Shows different UI based on owner's access key status:
 * - No access key: Empty state prompting to create one
 * - Has access key: Delegation UI to authorize team members
 */
export function AccessKeysContent({
  ownerHasAccessKey,
  orgAccessKeys,
  members,
  organizationId,
}: AccessKeysContentProps) {
  // If owner hasn't set up their access key yet, show setup prompt
  if (!ownerHasAccessKey) {
    return <SetupAccessKeyPrompt />;
  }

  // Owner has access key - show delegation UI
  return (
    <DelegationUI
      orgAccessKeys={orgAccessKeys}
      members={members}
      organizationId={organizationId}
    />
  );
}

/**
 * Empty state shown when owner hasn't created an access key yet
 */
function SetupAccessKeyPrompt() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Access Keys</CardTitle>
        <CardDescription>Delegate spending authority to team members</CardDescription>
      </CardHeader>
      <CardContent>
        <Empty className="py-8">
          <EmptyMedia variant="icon">
            <Key />
          </EmptyMedia>
          <EmptyTitle>Set Up Access Key First</EmptyTitle>
          <EmptyDescription>
            Before you can delegate spending to team members, you need to create an access key for
            your wallet. This authorizes the platform to process payments on your behalf.
          </EmptyDescription>
          <Button
            className="mt-4"
            nativeButton={false}
            render={<Link href="/settings/access-keys" />}
          >
            <ExternalLink className="size-4 mr-2" />
            Create Access Key
          </Button>
        </Empty>
      </CardContent>
    </Card>
  );
}

interface DelegationUIProps {
  orgAccessKeys: OrgAccessKey[];
  members: OrgMember[];
  organizationId: string;
}

/**
 * Full delegation UI for managing team member access
 */
function DelegationUI({
  orgAccessKeys,
  members,
  organizationId,
}: DelegationUIProps) {
  const [localKeys, setLocalKeys] = useState(orgAccessKeys);
  const [keyToRevoke, setKeyToRevoke] = useState<OrgAccessKey | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const activeKeys = localKeys.filter((k) => k.status === 'active');
  const revokedKeys = localKeys.filter((k) => k.status === 'revoked');

  const handleRevoke = async () => {
    if (!keyToRevoke) return;

    try {
      setIsRevoking(true);

      const res = await fetch(
        `/api/organizations/${organizationId}/access-keys/${keyToRevoke.id}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to revoke Access Key');
      }

      setLocalKeys((prev) =>
        prev.map((k) => (k.id === keyToRevoke.id ? { ...k, status: 'revoked' } : k))
      );
      setKeyToRevoke(null);
    } catch (err) {
      console.error('Failed to revoke access key:', err);
    } finally {
      setIsRevoking(false);
    }
  };

  const handleCreateSuccess = (newKey: OrgAccessKey) => {
    setLocalKeys((prev) => [...prev, newKey]);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle>Team Spending Access</CardTitle>
              <Popover>
                <PopoverTrigger className="text-muted-foreground hover:text-foreground transition-colors">
                  <HelpCircle className="size-4" />
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-2">
                    <p className="font-medium text-sm">How Team Access Works</p>
                    <p className="text-sm text-muted-foreground">
                      Access Keys allow team members to spend from the organization wallet without
                      requiring you to manually approve each transaction.
                    </p>
                    <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                      <li>Each key is tied to a specific team member&apos;s passkey</li>
                      <li>Keys have configurable spending limits per token</li>
                      <li>Keys can have expiration dates for time-limited access</li>
                      <li>You can revoke access at any time</li>
                    </ul>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <CardDescription>Authorize team members to spend from the org wallet</CardDescription>
          </div>
          {localKeys.length > 0 && (
            <Button size="sm" onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="size-4 mr-2" />
              Add Member
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {localKeys.length === 0 ? (
            <Empty className="py-8">
              <EmptyMedia variant="icon">
                <Key />
              </EmptyMedia>
              <EmptyTitle>No Team Access Keys</EmptyTitle>
              <EmptyDescription>
                Authorize team members to spend from the organization wallet with configurable
                limits. Each member signs with their own passkey.
              </EmptyDescription>
              <Button className="mt-4" onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="size-4 mr-2" />
                Authorize First Member
              </Button>
            </Empty>
          ) : (
            <div className="space-y-6">
              {activeKeys.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Active ({activeKeys.length})
                  </h4>
                  <div className="space-y-2">
                    {activeKeys.map((key) => (
                      <AccessKeyItem
                        key={key.id}
                        accessKey={key}
                        onRevoke={() => setKeyToRevoke(key)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {revokedKeys.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Revoked ({revokedKeys.length})
                  </h4>
                  <div className="space-y-2 opacity-60">
                    {revokedKeys.map((key) => (
                      <AccessKeyItem key={key.id} accessKey={key} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revoke Confirmation Dialog */}
      <AlertDialog open={!!keyToRevoke} onOpenChange={() => setKeyToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Access</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke access for{' '}
              <strong>{keyToRevoke?.user?.name || 'this team member'}</strong>? They will no longer
              be able to spend from the organization wallet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRevoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={isRevoking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRevoking ? 'Revoking...' : 'Revoke Access'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateOrgAccessKeyModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onSuccess={handleCreateSuccess}
        members={members}
        organizationId={organizationId}
        tokenAddress={DEFAULT_LIMIT_TOKEN}
      />
    </div>
  );
}

interface AccessKeyItemProps {
  accessKey: OrgAccessKey;
  onRevoke?: () => void;
}

function AccessKeyItem({ accessKey, onRevoke }: AccessKeyItemProps) {
  const isActive = accessKey.status === 'active';
  const isExpired = accessKey.expiry && Date.now() / 1000 > Number(accessKey.expiry);

  // Parse limits
  const limits = accessKey.limits as Record<string, { initial: string; remaining: string }>;
  const limitEntries = Object.entries(limits);
  const totalLimit =
    limitEntries.length > 0
      ? (BigInt(limitEntries[0][1].initial) / BigInt(1_000_000)).toString()
      : '0';
  const remainingLimit =
    limitEntries.length > 0
      ? (BigInt(limitEntries[0][1].remaining) / BigInt(1_000_000)).toString()
      : '0';

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="size-10">
            <AvatarFallback>
              <User className="size-4" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium truncate">
                {accessKey.user?.name || accessKey.label || 'Team Member'}
              </p>
              {isActive && !isExpired && <Badge>Active</Badge>}
              {isExpired && <Badge variant="secondary">Expired</Badge>}
              {accessKey.status === 'revoked' && <Badge variant="secondary">Revoked</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              {accessKey.label || 'Team spending access'}
            </p>
          </div>
        </div>

        {isActive && !isExpired && onRevoke && (
          <Button variant="outline" size="sm" onClick={onRevoke}>
            Revoke
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t text-sm">
        <div>
          <p className="text-muted-foreground">Limit</p>
          <p className="font-medium">${totalLimit}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Remaining</p>
          <p className="font-medium">${remainingLimit}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Created</p>
          <p className="font-medium">
            {accessKey.createdAt ? formatTimeAgo(accessKey.createdAt) : 'Unknown'}
          </p>
        </div>
      </div>
    </div>
  );
}
