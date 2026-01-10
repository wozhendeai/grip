'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PasskeyOperationContent, getPasskeyTitle } from '@/components/tempo';
import { HelpCircle } from 'lucide-react';
import type { PasskeyOperationError, PasskeyPhase } from '@/lib/webauthn';
import { useCallback, useMemo, useState } from 'react';
import { authClient } from '@/lib/auth/auth-client';
import { config } from '@/lib/wagmi-config';
import { getChainId } from '@/lib/network';
import type { OrgAccessKey, OrgMember } from '../_lib/types';

type CreateOrgAccessKeyModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (key: OrgAccessKey) => void;
  members: OrgMember[];
  organizationId: string;
  tokenAddress: `0x${string}`;
};

export function CreateOrgAccessKeyModal({
  open,
  onOpenChange,
  onSuccess,
  members,
  organizationId,
  tokenAddress,
}: CreateOrgAccessKeyModalProps) {
  const [phase, setPhase] = useState<PasskeyPhase>('ready');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [spendingLimit, setSpendingLimit] = useState('1000');
  const [error, setError] = useState<PasskeyOperationError | null>(null);

  // Filter to only non-owner members (owner doesn't need delegation to their own wallet)
  // and members with passkeys
  const eligibleMembers = useMemo(() => {
    return members.filter((m) => {
      if (m.role === 'owner') return false;
      return m.user !== null;
    });
  }, [members]);

  // Get selected member's passkey address
  const selectedMember = useMemo(() => {
    return members.find((m) => m.user?.id === selectedMemberId);
  }, [members, selectedMemberId]);

  const selectedMemberWalletAddress = useMemo(() => {
    const passkeyWallet = selectedMember?.user?.wallets?.find((w) => w.walletType === 'passkey');
    return passkeyWallet?.address ?? null;
  }, [selectedMember]);

  const handleCreate = useCallback(async () => {
    if (!selectedMemberId || !selectedMemberWalletAddress) {
      setError({
        type: 'operation_failed',
        message: 'Selected team member has no passkey wallet. They need to create one first.',
        phase: 'process',
      });
      setPhase('error');
      return;
    }

    setError(null);
    setPhase('signing');

    try {
      const limitAmount = BigInt(spendingLimit) * BigInt(1_000_000);

      // Sign authorization for team member's passkey (webAuthn type)
      const { data: signResult, error: signError } = await authClient.signKeyAuthorization({
        config,
        chainId: getChainId(),
        keyType: 'webAuthn',
        address: selectedMemberWalletAddress as `0x${string}`,
        limits: [{ token: tokenAddress, amount: limitAmount }],
      });

      if (signError || !signResult) {
        setError({
          type: 'unknown',
          message: signError?.message || 'Failed to sign authorization',
          phase: 'sign',
        });
        setPhase('error');
        return;
      }

      // Create access key via API
      setPhase('processing');
      const createRes = await fetch(`/api/organizations/${organizationId}/access-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamMemberUserId: selectedMemberId,
          spendingLimits: [
            {
              tokenAddress,
              amount: limitAmount.toString(),
            },
          ],
          authorizationSignature: signResult.signature,
          authorizationHash: signResult.hash,
        }),
      });

      if (!createRes.ok) {
        const data = await createRes.json().catch(() => ({}));
        setError({
          type: 'operation_failed',
          message: data.error || 'Failed to create Access Key. Please try again.',
          phase: 'process',
        });
        setPhase('error');
        return;
      }

      const result = await createRes.json();
      setPhase('success');

      // Transform API response to match OrgAccessKey type
      const newKey: OrgAccessKey = {
        id: result.id,
        organizationId: result.organizationId,
        chainId: result.chainId,
        rootWalletId: result.rootWalletId,
        keyWalletId: result.keyWalletId,
        keyType: result.keyType ?? null,
        expiry: result.expiry ?? null,
        limits: result.limits,
        status: result.status,
        createdAt: result.createdAt,
        label: result.label,
        user: selectedMember?.user
          ? {
              id: selectedMember.user.id,
              name: selectedMember.user.name,
            }
          : null,
      };

      onSuccess(newKey);

      setTimeout(() => {
        onOpenChange(false);
        setPhase('ready');
        setError(null);
        setSelectedMemberId('');
        setSpendingLimit('1000');
      }, 2000);
    } catch (err) {
      setError({
        type: 'unknown',
        message: err instanceof Error ? err.message : 'An unexpected error occurred',
        phase: 'sign',
      });
      setPhase('error');
    }
  }, [
    selectedMemberId,
    selectedMemberWalletAddress,
    selectedMember,
    spendingLimit,
    tokenAddress,
    organizationId,
    onSuccess,
    onOpenChange,
  ]);

  const handleClose = useCallback(
    (newOpen: boolean) => {
      // Prevent closing during active operations
      const canClose = !['connecting', 'signing', 'registering', 'processing'].includes(phase);

      if (!newOpen && !canClose) {
        return;
      }

      onOpenChange(newOpen);

      // Reset state after close
      if (!newOpen) {
        setTimeout(() => {
          setPhase('ready');
          setError(null);
          setSelectedMemberId('');
          setSpendingLimit('1000');
        }, 300);
      }
    },
    [phase, onOpenChange]
  );

  const handleRetry = useCallback(() => {
    setError(null);
    setPhase('ready');
  }, []);

  const canCreate =
    selectedMemberId && selectedMemberWalletAddress && spendingLimit && Number(spendingLimit) > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{getPasskeyTitle(phase, error, 'signing', 'Team Access Key')}</DialogTitle>
            <Popover>
              <PopoverTrigger className="text-muted-foreground hover:text-foreground transition-colors">
                <HelpCircle className="size-4" />
              </PopoverTrigger>
              <PopoverContent className="w-72">
                <div className="space-y-2">
                  <p className="font-medium text-sm">Delegate Spending Access</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Team member can spend from the org wallet using their passkey</li>
                    <li>• Spending is capped at the limit you set</li>
                    <li>• You can revoke access at any time</li>
                    <li>• All transactions are logged and auditable</li>
                  </ul>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </DialogHeader>

        <PasskeyOperationContent
          phase={phase}
          error={error}
          operationType="signing"
          operationLabel="Team Access Key"
          onRetry={handleRetry}
          onCreateWallet={() => {
            window.location.href = '/settings/wallet';
          }}
          successMessage="Team member authorized!"
        >
          {/* Custom ready-state content */}
          {phase === 'ready' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="team-member">Team Member</Label>
                <Select
                  value={selectedMemberId}
                  onValueChange={(v) => setSelectedMemberId(v ?? '')}
                >
                  <SelectTrigger id="team-member">
                    <SelectValue>
                      {selectedMemberId
                        ? eligibleMembers.find((m) => m.user?.id === selectedMemberId)?.user
                            ?.name || 'Selected member'
                        : 'Select a team member'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleMembers.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">
                        No eligible team members
                      </div>
                    ) : (
                      eligibleMembers.map((member) => {
                        const hasWallet = member.user?.wallets?.some(
                          (w) => w.walletType === 'passkey'
                        );
                        return (
                          <SelectItem
                            key={member.user?.id}
                            value={member.user?.id ?? ''}
                            disabled={!hasWallet}
                          >
                            <div className="flex items-center gap-2">
                              <span>{member.user?.name || member.user?.email}</span>
                              {!hasWallet && (
                                <span className="text-xs text-muted-foreground">(no wallet)</span>
                              )}
                            </div>
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
                {selectedMemberId && !selectedMemberWalletAddress && (
                  <p className="text-sm text-destructive">
                    This team member hasn&apos;t created a wallet yet. They need to create one
                    before you can authorize spending.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="spending-limit">Spending Limit (USDC)</Label>
                <Input
                  id="spending-limit"
                  type="number"
                  min="1"
                  step="1"
                  value={spendingLimit}
                  onChange={(e) => setSpendingLimit(e.target.value)}
                  placeholder="1000"
                />
                <p className="caption text-muted-foreground">
                  Maximum USDC this team member can spend from the org wallet
                </p>
              </div>

              <Button onClick={handleCreate} className="w-full" disabled={!canCreate}>
                Sign & Authorize
              </Button>
            </div>
          )}
        </PasskeyOperationContent>
      </DialogContent>
    </Dialog>
  );
}
