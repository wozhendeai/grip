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
import { useEffect, useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Abis } from 'tempo.ts/viem';

/**
 * Payment signing modal - SDK Version
 *
 * Shows transaction details and handles the WebAuthn signing flow via Tempo SDK.
 *
 * Migration from custom signing to SDK:
 * - BEFORE: Manual navigator.credentials.get(), RLP encoding, nonce management
 * - AFTER: SDK handles everything via useWriteContract hook
 *
 * Flow:
 * 1. User clicks "Sign & Send"
 * 2. SDK triggers WebAuthn prompt automatically
 * 3. User confirms with biometric/PIN
 * 4. SDK signs, broadcasts, and returns tx hash
 * 5. We wait for confirmation via useWaitForTransactionReceipt
 * 6. Modal shows success
 *
 * Key simplification: No manual transaction building, signing, or broadcasting.
 * SDK abstracts all complexity via Wagmi hooks.
 */

interface PayoutDetails {
  id: string;
  amount: bigint; // Changed from number to bigint for precision
  tokenAddress: string;
  recipientAddress: string;
  memo: string; // Hex-encoded memo
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
  claimant: ClaimantInfo;
  onSuccess?: (txHash: string) => void;
  autoSign?: boolean;
}

export function PaymentModal({
  open,
  onOpenChange,
  payout,
  claimant,
  onSuccess,
  autoSign = false,
}: PaymentModalProps) {
  const [confirming, setConfirming] = useState(false);

  // SDK hook for writing contract (signs + broadcasts automatically)
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();

  // SDK hook for waiting for transaction confirmation
  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Handle successful confirmation - update database
  useEffect(() => {
    if (isSuccess && txHash && !confirming) {
      setConfirming(true);

      // Confirm payout in database
      fetch(`/api/payouts/${payout.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash, waitForConfirmation: false }),
      })
        .then(() => {
          onSuccess?.(txHash);
        })
        .catch((err) => {
          console.error('Failed to confirm payout in database:', err);
        })
        .finally(() => {
          setConfirming(false);
        });
    }
  }, [isSuccess, txHash, payout.id, onSuccess, confirming]);

  // Handle sign button click
  const handleSign = () => {
    writeContract({
      address: payout.tokenAddress as `0x${string}`,
      abi: Abis.tip20,
      functionName: 'transferWithMemo',
      args: [payout.recipientAddress as `0x${string}`, payout.amount, payout.memo as `0x${string}`],
    });
  };

  const handleClose = () => {
    if (isPending || isConfirming || confirming) {
      // Don't allow closing during active transaction
      return;
    }
    onOpenChange(false);
  };

  const isProcessing = isPending || isConfirming || confirming;

  // Format amount for display (assuming 6 decimals for USDC)
  const formattedAmount = (Number(payout.amount) / 1_000_000).toFixed(2);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isSuccess ? 'Payment Sent' : 'Confirm Payment'}</DialogTitle>
          <DialogDescription>
            {isSuccess
              ? 'The bounty payment has been processed.'
              : 'Review the payment details and sign with your treasury passkey.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isSuccess ? (
            // Success state
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/20">
                <Check className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="font-medium">Payment Complete</p>
                <p className="text-sm text-muted-foreground mt-1">
                  ${formattedAmount} USDC sent to {claimant.name ?? 'contributor'}
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
                  <span className="font-medium text-lg">${formattedAmount} USDC</span>
                </div>

                <div className="border-t border-border pt-3">
                  <span className="text-sm text-muted-foreground">Recipient</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-medium">{claimant.name ?? 'Contributor'}</span>
                  </div>
                  <AddressDisplay address={claimant.address} className="mt-1 text-xs" />
                </div>
              </div>

              {/* Status indicators - SDK hook states */}
              {isPending && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Waiting for passkey signature...</span>
                </div>
              )}

              {isConfirming && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Confirming transaction on-chain...</span>
                </div>
              )}

              {confirming && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Updating payout status...</span>
                </div>
              )}

              {writeError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                  <p className="text-sm text-destructive">
                    {writeError.message.includes('User rejected')
                      ? 'Passkey signing was cancelled. Please try again.'
                      : writeError.message}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          {isSuccess ? (
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
