'use client';

import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getCurrentNetwork } from '@/db/network';
import { cn } from '@/lib/utils';
import { BACKEND_WALLET_ADDRESSES, TEMPO_TOKENS } from '@/lib/tempo/constants';
import { ArrowLeft, ArrowRight, CheckCircle2, Hand, Loader2, Zap } from 'lucide-react';
import { useState } from 'react';
import { KeyAuthorization } from 'tempo.ts/ox';
import { useSignMessage } from 'wagmi';

type PayoutMode = 'auto' | 'manual';

interface OnboardingStepAutopayProps {
  hasWallet: boolean;
  hasAccessKey: boolean;
  onBack: () => void;
  onNext: (settings: { autoPayEnabled: boolean }) => void;
}

export function OnboardingStepAutopay({
  hasWallet,
  hasAccessKey,
  onBack,
  onNext,
}: OnboardingStepAutopayProps) {
  const [mode, setMode] = useState<PayoutMode>(hasAccessKey ? 'auto' : 'manual');
  const [spendingLimit, setSpendingLimit] = useState('1000');
  const [status, setStatus] = useState<'ready' | 'signing' | 'creating' | 'success' | 'error'>(
    hasAccessKey ? 'success' : 'ready'
  );
  const [error, setError] = useState<string | null>(null);

  const { signMessageAsync } = useSignMessage();

  async function handleEnableAutoPay() {
    if (!hasWallet) {
      setError('You need to create a wallet first');
      return;
    }

    try {
      setStatus('signing');
      setError(null);

      const network = getCurrentNetwork();
      const backendWalletAddress = BACKEND_WALLET_ADDRESSES[network];

      const authorization = KeyAuthorization.from({
        chainId: BigInt(42429),
        type: 'secp256k1',
        address: backendWalletAddress as `0x${string}`,
        limits: [
          {
            token: TEMPO_TOKENS.USDC,
            limit: BigInt(spendingLimit) * BigInt(1_000_000),
          },
        ],
      });

      const hash = KeyAuthorization.getSignPayload(authorization);

      const signature = await signMessageAsync({
        message: { raw: hash },
      });

      setStatus('creating');

      const createRes = await fetch('/api/auth/tempo/access-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyId: backendWalletAddress,
          chainId: 42429,
          keyType: 0,
          limits: {
            [TEMPO_TOKENS.USDC]: (BigInt(spendingLimit) * BigInt(1_000_000)).toString(),
          },
          signature,
          label: 'GRIP Auto-pay',
        }),
      });

      if (!createRes.ok) {
        const data = await createRes.json();
        throw new Error(data.error || 'Failed to create Access Key');
      }

      setStatus('success');
    } catch (err) {
      console.error('Create Access Key error:', err);
      setStatus('error');

      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Passkey signature cancelled. Please try again.');
        } else if (err.name === 'NotSupportedError') {
          setError("Your device doesn't support passkeys.");
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to enable auto-pay. Please try again.');
      }
    }
  }

  function handleNext() {
    onNext({ autoPayEnabled: mode === 'auto' && status === 'success' });
  }

  // Already has access key - simplified view
  if (hasAccessKey && status === 'success') {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Automatic Payments
          </DialogTitle>
          <DialogDescription>
            You already have auto-pay enabled. Bounties will be paid automatically when PRs merge.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="p-4 bg-success/10 rounded-lg border border-success/20">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Auto-pay is enabled</span>
            </div>
          </div>
        </div>

        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={handleNext}>
            Next: You&apos;re Ready!
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="text-lg">Auto-Pay Setup Failed</DialogTitle>
          <DialogDescription>Something went wrong. You can try again or skip.</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        </div>

        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStatus('ready')}>
              Try Again
            </Button>
            <Button variant="ghost" onClick={() => onNext({ autoPayEnabled: false })}>
              Skip
            </Button>
          </div>
        </div>
      </>
    );
  }

  // Signing/Creating state
  if (status === 'signing' || status === 'creating') {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="text-lg">Enabling Auto-Pay</DialogTitle>
          <DialogDescription>
            {status === 'signing'
              ? 'Check your device for the passkey prompt'
              : 'Creating your access key...'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-12 text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-sm font-medium">
            {status === 'signing' ? 'Waiting for passkey signature...' : 'Almost done...'}
          </p>
        </div>
      </>
    );
  }

  // Success state (just created)
  if (status === 'success') {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            Auto-Pay Enabled!
          </DialogTitle>
          <DialogDescription>
            Bounty payouts will be signed automatically when PRs are merged.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="p-4 bg-success/10 rounded-lg border border-success/20">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Spending limit: ${spendingLimit} USDC</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleNext}>
            Next: You&apos;re Ready!
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </>
    );
  }

  // Ready state - mode selection
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-lg flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Automatic Payments
        </DialogTitle>
        <DialogDescription>
          When a PR is merged, how do you want to handle payouts?
        </DialogDescription>
      </DialogHeader>

      <div className="py-4 space-y-4">
        {/* Auto-pay option */}
        <button
          type="button"
          onClick={() => setMode('auto')}
          className={cn(
            'w-full text-left p-4 rounded-lg border-2 transition-colors',
            mode === 'auto'
              ? 'border-primary bg-primary/5'
              : 'border-muted hover:border-muted-foreground/20'
          )}
        >
          <div className="flex items-start gap-3">
            <Zap
              className={cn(
                'h-5 w-5 mt-0.5',
                mode === 'auto' ? 'text-primary' : 'text-muted-foreground'
              )}
            />
            <div>
              <p className="font-medium">Pay automatically</p>
              <p className="text-sm text-muted-foreground">
                Bounty is released when PR merges. No action needed.
              </p>
            </div>
          </div>
        </button>

        {/* Manual option */}
        <button
          type="button"
          onClick={() => setMode('manual')}
          className={cn(
            'w-full text-left p-4 rounded-lg border-2 transition-colors',
            mode === 'manual'
              ? 'border-primary bg-primary/5'
              : 'border-muted hover:border-muted-foreground/20'
          )}
        >
          <div className="flex items-start gap-3">
            <Hand
              className={cn(
                'h-5 w-5 mt-0.5',
                mode === 'manual' ? 'text-primary' : 'text-muted-foreground'
              )}
            />
            <div>
              <p className="font-medium">Require my approval</p>
              <p className="text-sm text-muted-foreground">
                You&apos;ll review and approve each payout manually.
              </p>
            </div>
          </div>
        </button>

        {/* Spending limit input (only for auto) */}
        {mode === 'auto' && hasWallet && (
          <div className="space-y-2 pt-2">
            <Label htmlFor="spending-limit">Spending limit per transaction (USDC)</Label>
            <Input
              id="spending-limit"
              type="number"
              min="1"
              step="1"
              value={spendingLimit}
              onChange={(e) => setSpendingLimit(e.target.value)}
              placeholder="1000"
            />
            <p className="text-xs text-muted-foreground">
              Maximum amount that can be paid per bounty without additional approval
            </p>
          </div>
        )}

        {mode === 'auto' && !hasWallet && (
          <div className="p-3 bg-chart-4/10 rounded-lg text-sm text-chart-4">
            You need to create a wallet first to enable auto-pay.
          </div>
        )}
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        {mode === 'auto' && hasWallet ? (
          <Button onClick={handleEnableAutoPay}>
            Sign & Enable Auto-Pay
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleNext}>
            {mode === 'manual' ? "Next: You're Ready!" : 'Skip for now'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </>
  );
}
