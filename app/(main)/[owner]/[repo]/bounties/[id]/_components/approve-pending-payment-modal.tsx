'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getCurrentNetwork } from '@/db/network';
import { BACKEND_WALLET_ADDRESSES } from '@/lib/tempo/constants';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
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
  const [status, setStatus] = useState<'ready' | 'signing' | 'success' | 'error'>('ready');
  const [error, setError] = useState<string | null>(null);

  // SDK hook for signing messages with WebAuthn
  const { signMessageAsync } = useSignMessage();

  async function handleAuthorize() {
    try {
      setStatus('signing');
      setError(null);

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

      // Sign with passkey via SDK (triggers WebAuthn prompt)
      const signature = await signMessageAsync({
        message: { raw: authHash },
      });

      setStatus('success');

      // Return signature to parent component
      // Parent will retry approval API with this signature
      onSuccess(signature, authHash);

      // Auto-close after success
      setTimeout(() => {
        onOpenChange(false);
        setStatus('ready');
      }, 1500);
    } catch (err) {
      console.error('Authorize payment error:', err);
      setStatus('error');

      // User-friendly error messages
      // Pattern: match WebAuthn error names to provide clear guidance
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Passkey signature cancelled. Please try again.');
        } else if (err.name === 'NotSupportedError') {
          setError("Your device doesn't support passkeys.");
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to authorize payment. Please try again.');
      }
    }
  }

  function handleClose() {
    if (status === 'signing') return; // Don't close during signing
    onOpenChange(false);
    setStatus('ready');
    setError(null);
  }

  // Format amount for display (assuming 6 decimals for USDC)
  const formattedAmount = (Number(paymentDetails.amount) / 1_000_000).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Authorize Pending Payment</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Payment Details */}
          <div className="space-y-2">
            <p className="body-base text-muted-foreground">
              @{paymentDetails.recipientGithubUsername} doesn't have a wallet yet. Authorize this
              payment now, and it will be sent automatically when they create an account.
            </p>

            <div className="rounded-lg bg-muted p-4">
              <div className="flex items-baseline justify-between">
                <span className="body-sm text-muted-foreground">Amount</span>
                <span className="heading-3">${formattedAmount} USDC</span>
              </div>
            </div>
          </div>

          {/* Educational Copy */}
          <div className="rounded-lg bg-primary/10 p-4 space-y-2">
            <h4 className="heading-4">What happens next?</h4>
            <ul className="body-sm text-muted-foreground space-y-1">
              <li>• You authorize a one-time payment of ${formattedAmount} USDC</li>
              <li>
                • Funds stay in your wallet until @{paymentDetails.recipientGithubUsername} creates
                an account
              </li>
              <li>• When they claim, the payment executes automatically</li>
              <li>• Authorization expires in 1 year if unclaimed</li>
            </ul>
          </div>

          {/* Error State */}
          {status === 'error' && error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1">
                <p className="body-sm text-destructive">{error}</p>
                <Button onClick={handleAuthorize} variant="outline" size="sm">
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {status === 'ready' && (
              <>
                <Button onClick={handleClose} variant="outline" className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleAuthorize} className="flex-1">
                  Authorize Payment
                </Button>
              </>
            )}

            {status === 'signing' && (
              <div className="flex items-center justify-center gap-2 p-4 w-full">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="body-base">Waiting for passkey signature...</span>
              </div>
            )}

            {status === 'success' && (
              <div className="flex items-center justify-center gap-2 p-4 w-full text-primary">
                <CheckCircle className="h-5 w-5" />
                <span className="body-base font-medium">Authorization Complete!</span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
