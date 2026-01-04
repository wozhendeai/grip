'use client';

import { AddressDisplay } from '@/components/tempo/address-display';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PasskeyOperationContent, getPasskeyTitle } from '@/components/passkey';
import { passkey } from '@/lib/auth/auth-client';
import {
  classifyWebAuthnError,
  type PasskeyOperationError,
  type PasskeyPhase,
} from '@/lib/webauthn';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * PasskeyManager - Client component for passkey creation/deletion
 *
 * Small client component: Only handles passkey mutations.
 * Parent server component passes existing wallet data.
 */

interface Wallet {
  id: string;
  name: string | null;
  tempoAddress: string | null;
  createdAt: string;
}

interface PasskeyManagerProps {
  wallet: Wallet | null;
}

export function PasskeyManager({ wallet }: PasskeyManagerProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<PasskeyPhase>('ready');
  const [error, setError] = useState<PasskeyOperationError | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCreateWallet = async () => {
    setError(null);
    setPhase('registering');

    try {
      await passkey.addPasskey({ name: 'GRIP Wallet' });

      setPhase('processing');
      // Refresh to show new wallet
      router.refresh();

      setPhase('success');

      setTimeout(() => {
        setShowCreateModal(false);
        setPhase('ready');
        setError(null);
      }, 2000);
    } catch (err) {
      const classified = classifyWebAuthnError(err, 'register', 'registration');
      setError(classified);
      setPhase('error');
    }
  };

  const handleDeleteWallet = async () => {
    if (!wallet) return;

    setIsDeleting(true);
    try {
      const result = await passkey.deletePasskey({ id: wallet.id });
      if (result.error) {
        throw new Error(result.error.message || 'Failed to delete');
      }
      router.refresh(); // Refresh to update UI
      setShowDeleteConfirm(false);
    } catch (err) {
      alert('Failed to delete wallet. Please try again.');
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCloseCreateModal = (newOpen: boolean) => {
    // Prevent closing during active operations
    const canClose = !['connecting', 'signing', 'registering', 'processing'].includes(phase);

    if (!newOpen && !canClose) {
      return;
    }

    setShowCreateModal(newOpen);

    // Reset state after close
    if (!newOpen) {
      setTimeout(() => {
        setPhase('ready');
        setError(null);
      }, 300);
    }
  };

  const handleRetry = () => {
    setError(null);
    setPhase('ready');
  };

  if (!wallet?.tempoAddress) {
    // No wallet - show creation UI
    return (
      <>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You don&apos;t have a wallet yet. Create one to receive bounty payments.
          </p>
          <Button onClick={() => setShowCreateModal(true)}>Create Wallet</Button>
          <p className="text-sm text-muted-foreground">
            This will prompt you to create a passkey using TouchID, FaceID, or your device&apos;s
            authentication method.
          </p>
        </div>

        <Dialog open={showCreateModal} onOpenChange={handleCloseCreateModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{getPasskeyTitle(phase, error, 'registration', 'Wallet')}</DialogTitle>
            </DialogHeader>

            <PasskeyOperationContent
              phase={phase}
              error={error}
              operationType="registration"
              operationLabel="Wallet"
              onRetry={handleRetry}
              successMessage="Wallet created successfully!"
            >
              {phase === 'ready' && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Create a secure wallet using your device biometrics.
                  </p>
                  <Button onClick={handleCreateWallet} className="w-full">
                    Create Wallet
                  </Button>
                </div>
              )}
            </PasskeyOperationContent>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Has wallet - show wallet details and delete option
  return (
    <div className="space-y-4">
      <div className="p-4 bg-muted/50 rounded-lg space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Address</span>
          <AddressDisplay address={wallet.tempoAddress} truncate={false} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Name</span>
          <span className="text-sm text-muted-foreground">{wallet.name || 'GRIP Wallet'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Created</span>
          <span className="text-sm text-muted-foreground">
            {new Date(wallet.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          render={
            <a
              href={`https://explore.tempo.xyz/address/${wallet.tempoAddress}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View on Explorer
            </a>
          }
        />
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm ? (
        <div className="p-4 border border-destructive/50 rounded-lg space-y-4">
          <p className="text-sm">
            Are you sure you want to delete this wallet? Any funds at this address will become
            inaccessible unless you have a backup of your passkey.
          </p>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteWallet}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Yes, Delete Wallet'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => setShowDeleteConfirm(true)}
        >
          Delete Wallet
        </Button>
      )}
    </div>
  );
}
