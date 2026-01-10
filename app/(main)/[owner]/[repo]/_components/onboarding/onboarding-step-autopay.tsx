'use client';

import { PasskeyOperationContent } from '@/components/tempo/passkey-operation-content';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth/auth-client';
import { getChainId } from '@/lib/network';
import { config } from '@/lib/wagmi-config';
import { cn } from '@/lib/utils';
import type { PasskeyOperationError, PasskeyPhase } from '@/lib/webauthn';
import { ArrowLeft, ArrowRight, CheckCircle2, Hand, Zap } from 'lucide-react';
import { useState } from 'react';

type PayoutMode = 'auto' | 'manual';

interface OnboardingStepAutopayProps {
  hasWallet: boolean;
  hasAccessKey: boolean;
  onBack: () => void;
  onNext: (settings: { autoPayEnabled: boolean }) => void;
  tokenAddress: `0x${string}` | undefined;
}

export function OnboardingStepAutopay({
  hasWallet,
  hasAccessKey,
  onBack,
  onNext,
  tokenAddress,
}: OnboardingStepAutopayProps) {
  const [mode, setMode] = useState<PayoutMode>(hasAccessKey ? 'auto' : 'manual');
  const [spendingLimit, setSpendingLimit] = useState('1000');
  const [phase, setPhase] = useState<PasskeyPhase>(hasAccessKey ? 'success' : 'ready');
  const [error, setError] = useState<PasskeyOperationError | null>(null);

  const hasToken = Boolean(tokenAddress);

  async function handleEnableAutoPay() {
    if (!hasWallet) {
      setError({
        type: 'wallet_not_found',
        message: 'You need to create a wallet first',
        phase: 'connect',
      });
      setPhase('error');
      return;
    }

    if (!tokenAddress) {
      setError({
        type: 'operation_failed',
        message: 'You need to set a fee token in your wallet settings first',
        phase: 'connect',
      });
      setPhase('error');
      return;
    }

    try {
      setError(null);
      setPhase('signing');

      const limitAmount = BigInt(spendingLimit) * BigInt(1_000_000);

      // Get user's passkey wallet
      const { data: passkeyWallet, error: walletError } = await authClient.getPasskeyWallet();
      if (walletError || !passkeyWallet) {
        setError({
          type: 'wallet_not_found',
          message: 'No passkey wallet found. Please create a wallet first.',
          phase: 'connect',
        });
        setPhase('error');
        return;
      }

      // Get server wallet for authorization
      const { data: serverWalletData, error: serverError } = await authClient.getServerWallet();
      if (serverError || !serverWalletData?.wallet) {
        setError({
          type: 'operation_failed',
          message: 'Server wallet not configured. Please contact support.',
          phase: 'connect',
        });
        setPhase('error');
        return;
      }
      const serverWallet = serverWalletData.wallet;

      // Sign authorization using tempo plugin
      const { data: signResult, error: signError } = await authClient.signKeyAuthorization({
        config,
        chainId: getChainId(),
        keyType: 'secp256k1',
        address: serverWallet.address as `0x${string}`,
        limits: [{ token: tokenAddress, amount: limitAmount }],
      });

      if (signError || !signResult) {
        setError({
          type: 'unknown',
          message: signError?.message || 'Failed to sign authorization',
          phase: 'sign',
        });
        setPhase('error');
        return;
      }

      // Create access key
      setPhase('processing');
      const { error: createError } = await authClient.createAccessKey({
        rootWalletId: passkeyWallet.id,
        keyWalletAddress: serverWallet.address as `0x${string}`,
        chainId: getChainId(),
        limits: [{ token: tokenAddress, limit: limitAmount.toString() }],
        authorizationSignature: signResult.signature,
        authorizationHash: signResult.hash,
        label: 'GRIP Auto-pay',
      });

      if (createError) {
        setError({
          type: 'operation_failed',
          message: 'Failed to create Access Key. Please try again.',
          phase: 'process',
        });
        setPhase('error');
        return;
      }

      setPhase('success');
    } catch (err) {
      setError({
        type: 'unknown',
        message: err instanceof Error ? err.message : 'An unexpected error occurred',
        phase: 'sign',
      });
      setPhase('error');
    }
  }

  function handleRetry() {
    setError(null);
    setPhase('ready');
  }

  function handleNext() {
    onNext({ autoPayEnabled: mode === 'auto' && phase === 'success' });
  }

  // Already has access key - simplified view
  if (hasAccessKey && phase === 'success') {
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

  // Success state (just created)
  if (phase === 'success') {
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

  // Active operation states (connecting, signing, processing, error)
  if (phase !== 'ready') {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="text-lg">
            {phase === 'error' ? 'Auto-Pay Setup Failed' : 'Enabling Auto-Pay'}
          </DialogTitle>
          <DialogDescription>
            {phase === 'error'
              ? 'Something went wrong. You can try again or skip.'
              : 'Check your device for the passkey prompt'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <PasskeyOperationContent
            phase={phase}
            error={error}
            operationType="signing"
            operationLabel="Auto-Pay"
            onRetry={handleRetry}
            onCreateWallet={onBack}
          />
        </div>

        {phase === 'error' && (
          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button variant="ghost" onClick={() => onNext({ autoPayEnabled: false })}>
              Skip
            </Button>
          </div>
        )}
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

        {mode === 'auto' && hasWallet && !hasToken && (
          <div className="p-3 bg-chart-4/10 rounded-lg text-sm text-chart-4">
            You need to set a fee token in your wallet settings to enable auto-pay. You can skip
            this step and set it up later.
          </div>
        )}
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        {mode === 'auto' && hasWallet && hasToken ? (
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
