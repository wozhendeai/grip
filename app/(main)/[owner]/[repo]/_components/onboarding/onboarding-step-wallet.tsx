'use client';

import { PasskeyOperationContent } from '@/components/tempo/passkey-operation-content';
import { AddressDisplay } from '@/components/tempo/address-display';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { passkey } from '@/lib/auth/auth-client';
import {
  classifyWebAuthnError,
  type PasskeyOperationError,
  type PasskeyPhase,
} from '@/lib/webauthn';
import { ArrowLeft, ArrowRight, Fingerprint, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface OnboardingStepWalletProps {
  hasWallet: boolean;
  walletAddress: string | null;
  onWalletCreated: () => void;
  onBack: () => void;
  onNext: () => void;
}

export function OnboardingStepWallet({
  hasWallet,
  walletAddress,
  onWalletCreated,
  onBack,
  onNext,
}: OnboardingStepWalletProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<PasskeyPhase>('ready');
  const [error, setError] = useState<PasskeyOperationError | null>(null);

  async function handleCreateWallet() {
    setError(null);
    setPhase('registering');

    try {
      await passkey.addPasskey({ name: 'GRIP Wallet' });
      setPhase('success');
      router.refresh();
      onWalletCreated();
    } catch (err) {
      const classified = classifyWebAuthnError(err, 'register', 'registration');
      setError(classified);
      setPhase('error');
    }
  }

  function handleRetry() {
    setError(null);
    setPhase('ready');
  }

  // Success state - wallet just created
  if (phase === 'success') {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="text-lg">Wallet Created!</DialogTitle>
          <DialogDescription>
            Your wallet is ready. You can fund it anytime from your settings.
          </DialogDescription>
        </DialogHeader>

        <PasskeyOperationContent
          phase={phase}
          error={error}
          operationType="registration"
          operationLabel="Wallet"
          successMessage="Your wallet is ready!"
        />

        {walletAddress && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Your Address</span>
              <AddressDisplay address={walletAddress} truncate={false} />
            </div>
          </div>
        )}

        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={onNext}>
            Next: Auto-Pay
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </>
    );
  }

  // Already has wallet
  if (hasWallet && walletAddress) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Your Bounty Wallet
          </DialogTitle>
          <DialogDescription>
            You already have a wallet set up. Bounties are paid from this address.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="p-4 bg-muted/50 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Address</span>
              <AddressDisplay address={walletAddress} truncate={false} />
            </div>
            <p className="text-xs text-muted-foreground">
              You control the keys — we never hold your funds.
            </p>
          </div>
        </div>

        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={onNext}>
            Next: Auto-Pay
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </>
    );
  }

  // No wallet - show creation UI with PasskeyOperationContent
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-lg flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Your Bounty Wallet
        </DialogTitle>
        <DialogDescription>
          Bounties are paid from your personal wallet. You control the keys — we never hold your
          funds.
        </DialogDescription>
      </DialogHeader>

      <div className="py-4">
        <PasskeyOperationContent
          phase={phase}
          error={error}
          operationType="registration"
          operationLabel="Wallet"
          onRetry={handleRetry}
        >
          {phase === 'ready' && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <div className="flex items-center gap-3">
                <Fingerprint className="h-8 w-8 text-primary" />
                <div className="text-sm">
                  <p className="font-medium">Passkey-secured wallet</p>
                  <p className="text-muted-foreground">
                    Uses TouchID, FaceID, or your device&apos;s authentication
                  </p>
                </div>
              </div>

              <Button onClick={handleCreateWallet} className="w-full">
                Create Wallet
              </Button>
            </div>
          )}
        </PasskeyOperationContent>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button variant="ghost" onClick={onNext}>
          Skip for now
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </>
  );
}
