'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PasskeyOperationContent, getPasskeyTitle } from '@/components/passkey';
import { getCurrentNetwork } from '@/db/network';
import { BACKEND_WALLET_ADDRESSES } from '@/lib/tempo/constants';
import {
  classifyWebAuthnError,
  type PasskeyOperationError,
  type PasskeyPhase,
} from '@/lib/webauthn';
import { useState } from 'react';
import { KeyAuthorization } from 'tempo.ts/ox';
import { useSignMessage } from 'wagmi';

type ApprovePendingPaymentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (signature: string, authHash: string) => void;
  paymentDetails: {
    amount: string;
    tokenAddress: string;
    recipientGithubUsername: string;
    recipientGithubUserId: string;
  };
  credentialId: string; // User's passkey credential ID
};

/**
 * Modal to collect Access Key signature for pending payment authorization
 *
 * Reuses signature collection pattern from create-access-key-modal.tsx
 * Key differences:
 * - No spending limit input (amount is predetermined)
 * - Different educational copy (dedicated single-use authorization)
 * - Returns signature to parent instead of creating Access Key directly
 *
 * Flow:
 * 1. Show payment details and educational copy
 * 2. User clicks "Authorize Payment"
 * 3. Build KeyAuthorization with exact amount
 * 4. Trigger passkey signature (WebAuthn)
 * 5. Return signature + hash to parent via onSuccess callback
 * 6. Parent retries approval API with signature
 */
export function ApprovePendingPaymentModal({
  open,
  onOpenChange,
  onSuccess,
  paymentDetails,
  credentialId,
}: ApprovePendingPaymentModalProps) {
  const [phase, setPhase] = useState<PasskeyPhase>('ready');
  const [error, setError] = useState<PasskeyOperationError | null>(null);

  // SDK hook for signing messages with WebAuthn
  const { signMessageAsync } = useSignMessage();

  async function handleAuthorize() {
    setError(null);
    setPhase('signing');

    try {
      // Get current network and backend wallet address
      const network = getCurrentNetwork();
      const backendWalletAddress = BACKEND_WALLET_ADDRESSES[network];

      // Build KeyAuthorization with exact payment amount
      // This authorization is single-use and will be revoked after claim
      const authorization = KeyAuthorization.from({
        chainId: BigInt(42429), // Tempo testnet
        type: 'secp256k1',
        address: backendWalletAddress as `0x${string}`,
        limits: [
          {
            token: paymentDetails.tokenAddress as `0x${string}`,
            limit: BigInt(paymentDetails.amount), // Exact amount - no more, no less
          },
        ],
      });

      // Compute signature hash using Tempo SDK
      const authHash = KeyAuthorization.getSignPayload(authorization);

      // TODO: Credential targeting issue - if user has multiple passkeys in browser but only
      // one in DB, the Tempo SDK might show all passkeys instead of the correct one.
      // Solution: Fetch credentialID from DB and update localStorage['webAuthn.lastActiveCredential']
      // before signing to ensure SDK targets the correct credential.
      // See: tempo.ts/src/wagmi/Connector.ts line 377

      // Sign with passkey via SDK (triggers WebAuthn prompt)
      const signature = await signMessageAsync({
        message: { raw: authHash },
      });

      setPhase('success');

      // Return signature to parent component
      // Parent will retry approval API with this signature
      onSuccess(signature, authHash);

      // Auto-close after success
      setTimeout(() => {
        onOpenChange(false);
        setPhase('ready');
        setError(null);
      }, 1500);
    } catch (err) {
      const classified = classifyWebAuthnError(err, 'sign', 'signing');
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

  // Format amount for display (assuming 6 decimals for USDC)
  const formattedAmount = (Number(paymentDetails.amount) / 1_000_000).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{getPasskeyTitle(phase, error, 'signing', 'Pending Payment')}</DialogTitle>
        </DialogHeader>

        <PasskeyOperationContent
          phase={phase}
          error={error}
          operationType="signing"
          operationLabel="Pending Payment"
          onRetry={handleRetry}
          onCreateWallet={() => {
            window.location.href = '/settings/wallet';
          }}
          successMessage="Authorization Complete!"
          educationalContent={
            <div className="rounded-lg bg-primary/10 p-4 space-y-2">
              <h4 className="heading-4">What happens next?</h4>
              <ul className="body-sm text-muted-foreground space-y-1">
                <li>• You authorize a one-time payment of ${formattedAmount} USDC</li>
                <li>
                  • Funds stay in your wallet until @{paymentDetails.recipientGithubUsername}{' '}
                  creates an account
                </li>
                <li>• When they claim, the payment executes automatically</li>
                <li>• Authorization expires in 1 year if unclaimed</li>
              </ul>
            </div>
          }
        >
          {/* Payment Details */}
          {phase === 'ready' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="body-base text-muted-foreground">
                  @{paymentDetails.recipientGithubUsername} doesn't have a wallet yet. Authorize
                  this payment now, and it will be sent automatically when they create an account.
                </p>

                <div className="rounded-lg bg-muted p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="body-sm text-muted-foreground">Amount</span>
                    <span className="heading-3">${formattedAmount} USDC</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => onOpenChange(false)} variant="outline" className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleAuthorize} className="flex-1">
                  Authorize Payment
                </Button>
              </div>
            </div>
          )}
        </PasskeyOperationContent>
      </DialogContent>
    </Dialog>
  );
}
