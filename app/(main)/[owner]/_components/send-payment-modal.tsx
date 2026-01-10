'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Hooks } from 'wagmi/tempo';

type SendPaymentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientUsername: string;
  recipientName: string | null;
  senderWalletAddress: `0x${string}` | null;
};

/**
 * SendPaymentModal Component
 *
 * Modal for sending direct payments to GitHub users.
 * Supports Access Key auto-signing for instant payments.
 *
 * Features:
 * - Amount input with validation
 * - Message input with 32-byte limit
 * - Real-time character count
 * - Auto-signing via Access Keys
 * - Success state with transaction link
 */
export function SendPaymentModal({
  open,
  onOpenChange,
  recipientUsername,
  recipientName,
  senderWalletAddress,
}: SendPaymentModalProps) {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Get sender's fee token preference
  const { data: userFeeToken, isLoading: isLoadingToken } = Hooks.fee.useUserToken({
    account: senderWalletAddress ?? '0x0000000000000000000000000000000000000000',
    query: { enabled: Boolean(senderWalletAddress) },
  });
  const tokenAddress = userFeeToken?.address as `0x${string}` | undefined;
  const hasToken = Boolean(tokenAddress);

  // Calculate UTF-8 byte length (not character length)
  // Emojis can be multiple bytes, so character count !== byte count
  const messageByteLength = new TextEncoder().encode(message).length;

  const handleSend = async () => {
    try {
      setIsSending(true);
      setError(null);

      if (!tokenAddress) {
        setError('Please set a fee token in your wallet settings first');
        return;
      }

      // Validate amount
      const amountNum = Number.parseFloat(amount);
      if (Number.isNaN(amountNum) || amountNum <= 0) {
        setError('Invalid amount');
        return;
      }

      // Convert amount to micro-dollars (6 decimals)
      const amountMicro = Math.floor(amountNum * 1_000_000);

      const response = await fetch('/api/payments/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientUsername,
          amount: amountMicro,
          tokenAddress,
          message,
          useAccessKey: true, // Auto-sign if Access Key available
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? 'Failed to send payment');
      }

      const data = await response.json();

      if (data.autoSigned) {
        // Payment sent automatically via Access Key
        setTxHash(data.payout.txHash);
      } else {
        // Manual signing needed (not yet implemented)
        throw new Error('Manual signing not yet implemented - please enable Access Key');
      }
    } catch (err) {
      console.error('[send-payment] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send payment');
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    // Reset state when closing
    setAmount('');
    setMessage('');
    setError(null);
    setTxHash(null);
    onOpenChange(false);
  };

  // Success state: Show transaction confirmation
  if (txHash) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="gap-6">
          <DialogHeader>
            <DialogTitle className="heading-3">Payment Sent!</DialogTitle>
          </DialogHeader>
          <div className="gap-4">
            <p className="body-base text-muted-foreground">
              Your payment to @{recipientUsername} has been sent successfully.
            </p>
            <a
              href={`/tx/${txHash}`}
              className="text-primary hover:underline body-sm"
              onClick={() => router.push(`/tx/${txHash}`)}
            >
              View transaction →
            </a>
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Main payment form
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="gap-6">
        <DialogHeader>
          <DialogTitle className="heading-3">
            Send Payment to {recipientName ? recipientName : `@${recipientUsername}`}
          </DialogTitle>
        </DialogHeader>
        <div className="gap-6">
          <div className="gap-2">
            <Label htmlFor="amount" className="body-base">
              Amount (USDC)
            </Label>
            <Input
              id="amount"
              type="number"
              placeholder="10.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              step="0.01"
              min="0"
              disabled={isSending}
            />
          </div>

          <div className="gap-2">
            <Label htmlFor="message" className="body-base">
              Message
            </Label>
            <Input
              id="message"
              placeholder="Thanks for your help!"
              value={message}
              onChange={(e) => {
                // Allow typing but warn if over limit
                setMessage(e.target.value);
              }}
              maxLength={100} // Soft limit for character count (byte limit checked on submit)
              disabled={isSending}
            />
            <p
              className={`body-sm ${
                messageByteLength > 32 ? 'text-destructive' : 'text-muted-foreground'
              }`}
            >
              {messageByteLength}/32 bytes
              {messageByteLength > 32 && ' (message too long)'}
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 p-4">
              <p className="body-sm text-destructive">{error}</p>
            </div>
          )}

          {!isLoadingToken && !hasToken && (
            <div className="rounded-lg bg-chart-4/10 p-4">
              <p className="body-sm text-chart-4">
                Set a fee token in your wallet settings to send payments.
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={
                !amount ||
                !message ||
                messageByteLength > 32 ||
                isSending ||
                Number(amount) <= 0 ||
                !hasToken
              }
              className="flex-1"
            >
              {isSending ? 'Sending...' : 'Send Payment'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
