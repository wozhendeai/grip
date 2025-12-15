'use client';

import { AddressDisplay } from '@/components/tempo/address-display';
import { Button } from '@/components/ui/button';
import { ButtonGroup, ButtonGroupSeparator } from '@/components/ui/button-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getExplorerTxUrl } from '@/lib/tempo/constants';
import { Check, ExternalLink, KeyRound, Loader2 } from 'lucide-react';
import { useCallback, useState } from 'react';

/**
 * Payment signing modal
 *
 * Shows transaction details and handles the WebAuthn signing flow.
 *
 * Flow:
 * 1. User clicks "Sign & Send" (or auto-signs if autoSign=true)
 * 2. Modal shows "Waiting for signature..."
 * 3. WebAuthn prompt appears
 * 4. User confirms with biometric/PIN
 * 5. Transaction is broadcast
 * 6. Modal shows success with tx hash
 *
 * Design decision: Modal handles signing client-side because treasury passkey
 * private key never leaves the device - server only prepares transaction params.
 */

type PaymentStatus = 'ready' | 'signing' | 'broadcasting' | 'confirming' | 'success' | 'error';

interface PayoutDetails {
  id: string;
  amount: number;
  tokenAddress: string;
  recipientAddress: string;
  memo: string;
}

interface TxParams {
  to: string;
  data: string;
  value: string;
}

interface ClaimantInfo {
  id: string;
  name: string | null;
  address: string;
}

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payout: PayoutDetails;
  txParams: TxParams;
  claimant: ClaimantInfo;
  treasuryCredentialId: string;
  treasuryAddress: string;
  onSuccess?: (txHash: string) => void;
  autoSign?: boolean;
}

export function PaymentModal({
  open,
  onOpenChange,
  payout,
  txParams,
  claimant,
  treasuryCredentialId,
  treasuryAddress,
  onSuccess,
  autoSign = false,
}: PaymentModalProps) {
  const [status, setStatus] = useState<PaymentStatus>('ready');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleSign = useCallback(async () => {
    setStatus('signing');
    setError(null);

    try {
      // Dynamic import to avoid SSR issues with WebAuthn
      const { signTempoTransaction, broadcastTransaction, getNonce, getGasPrice } = await import(
        '@/lib/tempo/signing'
      );

      // Get nonce and gas price from RPC
      const [nonce, gasPrice] = await Promise.all([
        getNonce(treasuryAddress as `0x${string}`),
        getGasPrice(),
      ]);

      // Prepare transaction parameters
      const txToSign = {
        to: txParams.to as `0x${string}`,
        data: txParams.data as `0x${string}`,
        value: BigInt(txParams.value),
        nonce,
        maxFeePerGas: gasPrice * BigInt(2), // 2x gas price buffer
        gas: BigInt(100_000), // Default gas for TIP-20 transfer
      };

      // Sign with passkey
      const signedTx = await signTempoTransaction({
        tx: txToSign,
        from: treasuryAddress as `0x${string}`,
        credentialId: treasuryCredentialId,
      });

      setStatus('broadcasting');

      // Broadcast to Tempo RPC
      const { txHash: hash } = await broadcastTransaction(signedTx);
      setTxHash(hash);

      setStatus('confirming');

      // Confirm payout in database
      await fetch(`/api/payouts/${payout.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash: hash, waitForConfirmation: false }),
      });

      setStatus('success');
      onSuccess?.(hash);
    } catch (err) {
      console.error('Payment error:', err);
      setStatus('error');

      // Provide user-friendly error messages
      if (err instanceof Error) {
        if (err.message.includes('credentials.get')) {
          setError('Passkey signing was cancelled or timed out. Please try again.');
        } else if (err.message.includes('Broadcast failed')) {
          setError(`Transaction failed: ${err.message}`);
        } else {
          setError(err.message);
        }
      } else {
        setError('An unknown error occurred');
      }
    }
  }, [treasuryCredentialId, treasuryAddress, txParams, payout.id, onSuccess]);

  // Auto-sign when modal opens (if enabled)
  // Disabled by default - user should see the transaction details first
  // useEffect(() => {
  //   if (open && autoSign && status === 'ready') {
  //     handleSign();
  //   }
  // }, [open, autoSign, status, handleSign]);

  const handleClose = () => {
    if (status === 'signing' || status === 'broadcasting') {
      // Don't allow closing during active transaction
      return;
    }
    setStatus('ready');
    setError(null);
    setTxHash(null);
    onOpenChange(false);
  };

  const isProcessing = status === 'signing' || status === 'broadcasting' || status === 'confirming';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{status === 'success' ? 'Payment Sent' : 'Confirm Payment'}</DialogTitle>
          <DialogDescription>
            {status === 'success'
              ? 'The bounty payment has been processed.'
              : 'Review the payment details and sign with your treasury passkey.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {status === 'success' ? (
            // Success state
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/20">
                <Check className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="font-medium">Payment Complete</p>
                <p className="text-sm text-muted-foreground mt-1">
                  ${(payout.amount / 1_000_000).toFixed(2)} USDC sent to{' '}
                  {claimant.name ?? 'contributor'}
                </p>
              </div>
              {txHash && (
                <a
                  href={getExplorerTxUrl(txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  View transaction
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ) : (
            // Transaction details
            <>
              <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <span className="font-medium text-lg">
                    ${(payout.amount / 1_000_000).toFixed(2)} USDC
                  </span>
                </div>

                <div className="border-t border-border pt-3">
                  <span className="text-sm text-muted-foreground">Recipient</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-medium">{claimant.name ?? 'Contributor'}</span>
                  </div>
                  <AddressDisplay address={claimant.address} className="mt-1 text-xs" />
                </div>

                <div className="border-t border-border pt-3">
                  <span className="text-sm text-muted-foreground">From Treasury</span>
                  <AddressDisplay address={treasuryAddress} className="mt-1 text-xs" />
                </div>
              </div>

              {/* Status indicators */}
              {status === 'signing' && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Waiting for passkey signature...</span>
                </div>
              )}

              {status === 'broadcasting' && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Broadcasting transaction...</span>
                </div>
              )}

              {status === 'confirming' && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Confirming payment...</span>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          {status === 'success' ? (
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          ) : (
            <ButtonGroup className="w-full">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isProcessing}
                className="flex-1"
              >
                Cancel
              </Button>
              <ButtonGroupSeparator />
              <Button onClick={handleSign} disabled={isProcessing} className="flex-1">
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <KeyRound className="mr-2 h-4 w-4" />
                    Sign & Send
                  </>
                )}
              </Button>
            </ButtonGroup>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
