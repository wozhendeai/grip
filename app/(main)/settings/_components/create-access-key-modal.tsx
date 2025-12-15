'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getCurrentNetwork } from '@/lib/db/network';
import { BACKEND_WALLET_ADDRESSES, TEMPO_TOKENS } from '@/lib/tempo/constants';
import { CheckCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';

type AccessKey = {
  id: string;
  backendWalletAddress: string;
  limits: Record<string, { initial: string; remaining: string }>;
  status: string;
  createdAt: string | null;
  lastUsedAt: string | null;
  label: string | null;
  expiry: number | null;
};

type CreateAccessKeyModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (key: AccessKey) => void;
  credentialId: string; // User's passkey credential ID
};

export function CreateAccessKeyModal({
  open,
  onOpenChange,
  onSuccess,
  credentialId,
}: CreateAccessKeyModalProps) {
  const [status, setStatus] = useState<'ready' | 'signing' | 'creating' | 'success' | 'error'>(
    'ready'
  );
  const [spendingLimit, setSpendingLimit] = useState('10000'); // Default $10k
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    try {
      setStatus('signing');
      setError(null);

      // Get current network and backend wallet address
      const network = getCurrentNetwork();
      const backendWalletAddress = BACKEND_WALLET_ADDRESSES[network];

      // Build KeyAuthorization params
      const params = {
        chainId: 42429, // Tempo testnet
        keyType: 0 as const, // secp256k1
        keyId: backendWalletAddress,
        limits: {
          [TEMPO_TOKENS.USDC]: (BigInt(spendingLimit) * BigInt(1_000_000)).toString(), // Convert to 6 decimals
        },
      };

      // Dynamic import to avoid SSR issues
      const { signKeyAuthorization } = await import('@/lib/tempo/access-keys');

      // Sign with passkey
      const { signature } = await signKeyAuthorization(
        {
          chainId: params.chainId,
          keyType: params.keyType,
          keyId: params.keyId as `0x${string}`,
          limits: [[TEMPO_TOKENS.USDC, BigInt(spendingLimit) * BigInt(1_000_000)]],
        },
        credentialId
      );

      setStatus('creating');

      // Create Access Key via API
      const createRes = await fetch('/api/access-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyId: backendWalletAddress,
          chainId: params.chainId,
          keyType: params.keyType,
          limits: params.limits,
          signature,
          label: 'BountyLane Auto-pay',
        }),
      });

      if (!createRes.ok) {
        const data = await createRes.json();
        throw new Error(data.error || 'Failed to create Access Key');
      }

      const { accessKey } = await createRes.json();

      setStatus('success');
      onSuccess(accessKey);

      // Auto-close after success
      setTimeout(() => {
        onOpenChange(false);
        setStatus('ready');
      }, 2000);
    } catch (err) {
      console.error('Create Access Key error:', err);
      setStatus('error');

      // User-friendly error messages
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Passkey signature cancelled. Please try again.');
        } else if (err.name === 'NotSupportedError') {
          setError("Your device doesn't support passkeys.");
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to create Access Key. Please try again.');
      }
    }
  }

  function handleClose() {
    // Prevent closing during signing/creating
    if (status === 'signing' || status === 'creating') return;

    onOpenChange(false);
    // Reset state when closing
    setTimeout(() => {
      setStatus('ready');
      setError(null);
      setSpendingLimit('10000');
    }, 300);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enable Auto-Pay</DialogTitle>
        </DialogHeader>

        {status === 'ready' && (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="spending-limit">Spending Limit (USDC)</Label>
                <Input
                  id="spending-limit"
                  type="number"
                  min="1"
                  step="1"
                  value={spendingLimit}
                  onChange={(e) => setSpendingLimit(e.target.value)}
                  placeholder="10000"
                />
                <p className="caption text-muted-foreground">
                  Maximum amount in USDC that BountyLane can spend on your behalf
                </p>
              </div>

              <div className="bg-muted p-4 rounded-lg space-y-2">
                <h4 className="heading-4">What is Auto-Pay?</h4>
                <ul className="body-sm text-muted-foreground space-y-1">
                  <li>• Automatically signs bounty payouts without manual approval</li>
                  <li>• You control spending limits and can revoke anytime</li>
                  <li>• Secured by Tempo's Account Keychain (on-chain authorization)</li>
                  <li>• Private keys never leave Turnkey's secure HSM</li>
                </ul>
              </div>
            </div>

            <Button
              onClick={handleCreate}
              className="w-full"
              disabled={!spendingLimit || Number(spendingLimit) <= 0}
            >
              Sign & Enable Auto-Pay
            </Button>
          </div>
        )}

        {status === 'signing' && (
          <div className="text-center py-12 space-y-4">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <div className="space-y-2">
              <p className="body-base font-medium">Waiting for passkey signature...</p>
              <p className="body-sm text-muted-foreground">
                Check your device for the passkey prompt
              </p>
            </div>
          </div>
        )}

        {status === 'creating' && (
          <div className="text-center py-12 space-y-4">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <div className="space-y-2">
              <p className="body-base font-medium">Creating Access Key...</p>
              <p className="body-sm text-muted-foreground">This will only take a moment</p>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center py-12 space-y-4">
            <CheckCircle className="mx-auto h-12 w-12 text-primary" />
            <div className="space-y-2">
              <p className="body-base font-medium">Auto-Pay enabled!</p>
              <p className="body-sm text-muted-foreground">
                Your bounty payouts will now be signed automatically
              </p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-6">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <p className="body-sm text-destructive">{error}</p>
            </div>
            <Button onClick={() => setStatus('ready')} variant="outline" className="w-full">
              Try Again
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
