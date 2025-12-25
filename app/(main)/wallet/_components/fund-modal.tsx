'use client';

import { AddressDisplay } from '@/components/tempo/address-display';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Check, Copy, Droplet, QrCode } from 'lucide-react';
import { useState } from 'react';

/**
 * FundModal - Modal for funding wallet with USDC
 *
 * Shows the user's wallet address for receiving deposits.
 * Testnet: Includes "Request Test Tokens" button for faucet.
 */

interface FundModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletAddress: string;
}

type FaucetStatus = 'idle' | 'requesting' | 'success' | 'error';

export function FundModal({ open, onOpenChange, walletAddress }: FundModalProps) {
  const [copied, setCopied] = useState(false);
  const [faucetStatus, setFaucetStatus] = useState<FaucetStatus>('idle');
  const [faucetMessage, setFaucetMessage] = useState<string>('');

  const isTestnet = process.env.NEXT_PUBLIC_TEMPO_NETWORK === 'testnet';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  async function handleRequestTestTokens() {
    setFaucetStatus('requesting');
    setFaucetMessage('');

    try {
      const res = await fetch('/api/wallet/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await res.json();

      if (res.ok) {
        setFaucetStatus('success');
        setFaucetMessage('Received test tokens! Check balance in ~30 seconds');
      } else if (res.status === 429) {
        setFaucetStatus('error');
        const hours = Math.ceil((result.retryAfter || 86400) / 3600);
        setFaucetMessage(`Rate limited. Try again in ${hours} hours`);
      } else {
        setFaucetStatus('error');
        setFaucetMessage(result.error || 'Failed to request tokens');
      }
    } catch (error) {
      setFaucetStatus('error');
      setFaucetMessage('Network error. Please try again');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fund Your Wallet</DialogTitle>
          <DialogDescription>Send USDC to this address on the Tempo network</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* QR Code Placeholder */}
          <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-lg border border-dashed border-border bg-muted/50">
            <div className="text-center">
              <QrCode className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-2 text-xs text-muted-foreground">QR Code</p>
            </div>
          </div>

          {/* Address Display */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Your Tempo Address</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2 font-mono text-xs break-all">
                {walletAddress}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <div className="rounded-lg bg-muted/50 p-4">
            <h4 className="text-sm font-medium mb-2">How to fund your wallet</h4>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Copy your Tempo address above</li>
              <li>Send USDC from an exchange or another wallet</li>
              <li>Make sure you&apos;re sending on the Tempo network</li>
              <li>Your balance will update once the transaction confirms</li>
            </ol>
          </div>
        </div>

        {/* Faucet Feedback Message */}
        {isTestnet && faucetMessage && (
          <div
            className={`rounded-lg border p-3 text-sm ${
              faucetStatus === 'success'
                ? 'border-success/30 bg-success/10 text-success'
                : 'border-destructive/30 bg-destructive/10 text-destructive'
            }`}
          >
            {faucetMessage}
          </div>
        )}

        <div className="flex justify-between">
          {isTestnet ? (
            <>
              <Button
                variant="secondary"
                className="gap-2"
                onClick={handleRequestTestTokens}
                disabled={faucetStatus === 'requesting'}
              >
                <Droplet className="h-4 w-4" />
                {faucetStatus === 'requesting' ? 'Requesting...' : 'Request Test Tokens'}
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)} className="ml-auto">
              Done
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
