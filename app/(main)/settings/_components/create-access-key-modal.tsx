'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasskeyOperationContent, getPasskeyTitle } from '@/components/tempo';
import { authClient } from '@/lib/auth/auth-client';
import { getChainId } from '@/lib/network';
import { config } from '@/lib/wagmi-config';
import type { PasskeyOperationError, PasskeyPhase } from '@/lib/webauthn';
import type { AccessKey } from '@/lib/auth/tempo-plugin/types';
import { useCallback, useState } from 'react';

type CreateAccessKeyModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (key: AccessKey) => void;
  tokenAddress: `0x${string}`;
};

export function CreateAccessKeyModal({
  open,
  onOpenChange,
  onSuccess,
  tokenAddress,
}: CreateAccessKeyModalProps) {
  const [phase, setPhase] = useState<PasskeyPhase>('ready');
  const [spendingLimit, setSpendingLimit] = useState('10000');
  const [error, setError] = useState<PasskeyOperationError | null>(null);

  const handleCreate = useCallback(async () => {
    setError(null);
    setPhase('signing');

    try {
      const limitAmount = BigInt(spendingLimit) * BigInt(1_000_000);

      // Get user's passkey wallet
      const { data: passkeyWallet, error: walletError } = await authClient.getPasskeyWallet();
      if (walletError || !passkeyWallet) {
        setError({
          type: 'wallet_not_found',
          message: 'No passkey wallet found. Please create a wallet first.',
          phase: 'connect',
        });
        setPhase('error');
        return;
      }

      // Get server wallet for authorization
      const { data: serverWalletData, error: serverError } = await authClient.getServerWallet();
      if (serverError || !serverWalletData?.wallet) {
        setError({
          type: 'operation_failed',
          message: 'Server wallet not configured. Please contact support.',
          phase: 'connect',
        });
        setPhase('error');
        return;
      }
      const serverWallet = serverWalletData.wallet;

      // Sign authorization using tempo plugin
      const { data: signResult, error: signError } = await authClient.signKeyAuthorization({
        config,
        chainId: getChainId(),
        keyType: 'secp256k1',
        address: serverWallet.address as `0x${string}`,
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

      // Create access key
      setPhase('processing');
      const { data, error: createError } = await authClient.createAccessKey({
        rootWalletId: passkeyWallet.id,
        keyWalletAddress: serverWallet.address as `0x${string}`,
        chainId: getChainId(),
        limits: [{ token: tokenAddress, limit: limitAmount.toString() }],
        authorizationSignature: signResult.signature,
        authorizationHash: signResult.hash,
        label: 'GRIP Auto-pay',
      });

      if (createError || !data?.accessKey) {
        setError({
          type: 'operation_failed',
          message: 'Failed to create Access Key. Please try again.',
          phase: 'process',
        });
        setPhase('error');
        return;
      }

      setPhase('success');
      onSuccess(data.accessKey);

      setTimeout(() => {
        onOpenChange(false);
        setPhase('ready');
        setError(null);
      }, 2000);
    } catch (err) {
      setError({
        type: 'unknown',
        message: err instanceof Error ? err.message : 'An unexpected error occurred',
        phase: 'sign',
      });
      setPhase('error');
    }
  }, [spendingLimit, tokenAddress, onSuccess, onOpenChange]);

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
          setSpendingLimit('10000');
        }, 300);
      }
    },
    [phase, onOpenChange]
  );

  const handleRetry = useCallback(() => {
    setError(null);
    setPhase('ready');
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{getPasskeyTitle(phase, error, 'signing', 'Access Key')}</DialogTitle>
        </DialogHeader>

        <PasskeyOperationContent
          phase={phase}
          error={error}
          operationType="signing"
          operationLabel="Access Key"
          onRetry={handleRetry}
          onCreateWallet={() => {
            window.location.href = '/settings/wallet';
          }}
          successMessage="Auto-Pay enabled!"
          educationalContent={
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <h4 className="heading-4">What is Auto-Pay?</h4>
              <ul className="body-sm text-muted-foreground space-y-1">
                <li>• Automatically signs bounty payouts without manual approval</li>
                <li>• You control spending limits and can revoke anytime</li>
                <li>• Secured by Tempo's Account Keychain (on-chain authorization)</li>
                <li>• Private keys never leave Turnkey's secure HSM</li>
              </ul>
            </div>
          }
        >
          {/* Custom ready-state content */}
          {phase === 'ready' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="spending-limit">Spending Limit (USDC)</Label>
                <Input
                  id="spending-limit"
                  type="number"
                  min="1"
                  step="1"
                  value={spendingLimit}
                  onChange={(e) => setSpendingLimit(e.target.value)}
                  placeholder="10000"
                />
                <p className="caption text-muted-foreground">
                  Maximum amount in USDC that GRIP can spend on your behalf
                </p>
              </div>

              <Button
                onClick={handleCreate}
                className="w-full"
                disabled={!spendingLimit || Number(spendingLimit) <= 0}
              >
                Sign & Enable Auto-Pay
              </Button>
            </div>
          )}
        </PasskeyOperationContent>
      </DialogContent>
    </Dialog>
  );
}
