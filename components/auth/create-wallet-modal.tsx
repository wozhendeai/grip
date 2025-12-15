'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { passkey } from '@/lib/auth-client';
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
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    try {
      setCreating(true);
      setError(null);

      // better-auth passkey creation
      await passkey.addPasskey({ name: 'BountyLane Wallet' });

      // Fetch created wallet (has tempoAddress field from tempo plugin)
      const res = await fetch('/api/user/passkeys');
      const data = await res.json();
      const wallet = data.passkeys.find((p: { tempoAddress?: string }) => p.tempoAddress);

      if (!wallet) {
        throw new Error('Wallet not found after creation');
      }

      onSuccess?.(wallet);
      onOpenChange(false);
    } catch (err: unknown) {
      // WebAuthn error handling
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Passkey creation cancelled. Try again.');
        } else if (err.name === 'NotSupportedError') {
          setError("Your device doesn't support passkeys.");
        } else {
          setError('Failed to create wallet. Please try again.');
        }
      } else {
        setError('Failed to create wallet. Please try again.');
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title ?? 'Create Wallet'}</DialogTitle>
          <DialogDescription>
            {description ?? 'Create a secure wallet using your device biometrics.'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? 'Creating...' : 'Create Wallet'}
          </Button>

          {allowSkip && (
            <Button variant="ghost" onClick={onSkip}>
              Skip for Now
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
