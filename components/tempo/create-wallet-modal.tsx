'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PasskeyOperationContent, getPasskeyTitle } from '@/components/tempo';
import { authClient } from '@/lib/auth/auth-client';
import {
  classifyWebAuthnError,
  type PasskeyOperationError,
  type PasskeyPhase,
} from '@/lib/webauthn';
import { useState } from 'react';

interface CreateWalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (wallet: { address: string; id: string }) => void;
  title?: string;
  description?: string;
  allowSkip?: boolean;
  onSkip?: () => void;
}

export function CreateWalletModal({
  open,
  onOpenChange,
  onSuccess,
  title,
  description,
  allowSkip,
  onSkip,
}: CreateWalletModalProps) {
  const [phase, setPhase] = useState<PasskeyPhase>('ready');
  const [error, setError] = useState<PasskeyOperationError | null>(null);

  async function handleCreate() {
    setError(null);
    setPhase('processing');

    try {
      // Check if user already has a passkey wallet
      const { data: walletsData } = await authClient.listWallets();
      const existingWallet = walletsData?.wallets.find((w) => w.walletType === 'passkey');

      if (existingWallet) {
        setError({
          type: 'operation_failed',
          message:
            'You already have a wallet. Delete your existing wallet from Settings to create a new one.',
          phase: 'process',
        });
        setPhase('error');
        return;
      }

      // Single call handles full WebAuthn ceremony + wallet creation
      setPhase('registering');
      const result = await authClient.registerPasskey({ name: 'GRIP Wallet' });

      if (result.error) {
        throw new Error(result.error.message || 'Failed to register passkey');
      }

      const wallet = result.data?.wallet;
      if (!wallet) {
        setError({
          type: 'operation_failed',
          message: 'Wallet not found after creation',
          phase: 'process',
        });
        setPhase('error');
        return;
      }

      setPhase('success');
      onSuccess?.({ address: wallet.address, id: wallet.id });

      setTimeout(() => {
        onOpenChange(false);
        setPhase('ready');
        setError(null);
      }, 2000);
    } catch (err) {
      const classified = classifyWebAuthnError(err, 'register', 'registration');
      setError(classified);
      setPhase('error');
    }
  }

  function handleClose(newOpen: boolean) {
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
      }, 300);
    }
  }

  function handleRetry() {
    setError(null);
    setPhase('ready');
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {getPasskeyTitle(phase, error, 'registration', title || 'Wallet')}
          </DialogTitle>
        </DialogHeader>

        <PasskeyOperationContent
          phase={phase}
          error={error}
          operationType="registration"
          operationLabel={title || 'Wallet'}
          onRetry={handleRetry}
          successMessage="Wallet created successfully!"
        >
          {phase === 'ready' && (
            <div className="space-y-4">
              <DialogDescription>
                {description ?? 'Create a secure wallet using your device biometrics.'}
              </DialogDescription>

              <Button onClick={handleCreate} className="w-full">
                Create Wallet
              </Button>

              {allowSkip && (
                <Button variant="ghost" onClick={onSkip} className="w-full">
                  Skip for Now
                </Button>
              )}
            </div>
          )}
        </PasskeyOperationContent>
      </DialogContent>
    </Dialog>
  );
}
