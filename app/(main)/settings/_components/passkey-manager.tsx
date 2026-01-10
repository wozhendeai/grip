'use client';

import { AddressDisplay } from '@/components/tempo/address-display';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Item, ItemContent, ItemGroup, ItemTitle } from '@/components/ui/item';
import { PasskeyOperationContent, getPasskeyTitle } from '@/components/tempo';
import { authClient } from '@/lib/auth/auth-client';
import {
  classifyWebAuthnError,
  type PasskeyOperationError,
  type PasskeyPhase,
} from '@/lib/webauthn';
import { AlertTriangle, ExternalLink, Key } from 'lucide-react';
import { useState } from 'react';
import { useDisconnect } from 'wagmi';

/**
 * PasskeyManager - Client component for passkey creation/deletion
 *
 * Small client component: Only handles passkey mutations.
 * Parent server component passes existing wallet data.
 */

interface Wallet {
  id: string;
  credentialID: string;
  name: string | null;
  tempoAddress: string | null;
  createdAt: string;
}

interface PasskeyManagerProps {
  wallet: Wallet | null;
}

export function PasskeyManager({ wallet }: PasskeyManagerProps) {
  const { disconnect } = useDisconnect();
  const [phase, setPhase] = useState<PasskeyPhase>('ready');
  const [error, setError] = useState<PasskeyOperationError | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCreateWallet = async () => {
    setError(null);
    setPhase('registering');

    try {
      // Single call handles full WebAuthn ceremony + wallet creation
      const result = await authClient.registerPasskey({ name: 'GRIP Wallet' });

      if (result.error) {
        throw new Error(result.error.message || 'Failed to register passkey');
      }

      // Nanostore auto-updates parent via usePasskeys hook
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
      // Delete passkey by WebAuthn credential ID (wallet cascades via FK)
      const result = await authClient.deletePasskey(wallet.credentialID);
      if (result.error) {
        throw new Error(result.error.message || 'Failed to delete');
      }
      // Disconnect wagmi to clear localStorage cache - nanostore auto-updates parent
      disconnect();
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
          <div className="flex flex-col items-center py-4 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Key className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              Create a wallet secured by your device&apos;s biometrics.
            </p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} className="w-full">
            Create Wallet
          </Button>
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

  // Has wallet - show wallet details and management options
  return (
    <div className="space-y-4">
      {/* Wallet Details */}
      <ItemGroup>
        <Item variant="muted">
          <ItemContent>
            <ItemTitle>Address</ItemTitle>
            <AddressDisplay address={wallet.tempoAddress} truncate={false} />
          </ItemContent>
        </Item>
        <Item variant="muted">
          <ItemContent>
            <ItemTitle>Name</ItemTitle>
            <span className="text-xs text-muted-foreground">{wallet.name || 'Wallet'}</span>
          </ItemContent>
        </Item>
        <Item variant="muted">
          <ItemContent>
            <ItemTitle>Created</ItemTitle>
            <span className="text-xs text-muted-foreground">
              {new Date(wallet.createdAt).toLocaleDateString()}
            </span>
          </ItemContent>
        </Item>
      </ItemGroup>

      {/* Actions */}
      <a
        href={`https://explore.tempo.xyz/address/${wallet.tempoAddress}`}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonVariants({ variant: 'outline', size: 'sm', className: 'w-full gap-2' })}
      >
        <ExternalLink className="h-3.5 w-3.5" />
        View on Explorer
      </a>

      {/* Delete confirmation */}
      {showDeleteConfirm ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Delete wallet?</AlertTitle>
          <AlertDescription>
            Funds at this address will be inaccessible without a passkey backup.
          </AlertDescription>
          <div className="mt-3 flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteWallet}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
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
        </Alert>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-destructive hover:text-destructive"
          onClick={() => setShowDeleteConfirm(true)}
        >
          Delete Wallet
        </Button>
      )}
    </div>
  );
}
