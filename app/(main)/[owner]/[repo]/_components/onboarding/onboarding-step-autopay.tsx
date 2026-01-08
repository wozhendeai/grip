'use client';

import { PasskeyOperationContent } from '@/components/tempo/passkey-operation-content';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getCurrentNetwork } from '@/db/network';
import { BACKEND_WALLET_ADDRESSES, TEMPO_TOKENS } from '@/lib/tempo/constants';
import { cn } from '@/lib/utils';
import {
  classifyWebAuthnError,
  type PasskeyOperationError,
  type PasskeyPhase,
} from '@/lib/webauthn';
import { ArrowLeft, ArrowRight, CheckCircle2, Hand, Zap } from 'lucide-react';
import { useState } from 'react';
import { KeyAuthorization } from 'ox/tempo';
import { useConnect, useConnections, useConnectors, useSignMessage } from 'wagmi';

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
  const [phase, setPhase] = useState<PasskeyPhase>(hasAccessKey ? 'success' : 'ready');
  const [error, setError] = useState<PasskeyOperationError | null>(null);

  const connectors = useConnectors();
  const connections = useConnections();
  const connect = useConnect();
  const signMessage = useSignMessage();

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

    try {
      setError(null);
      setPhase('connecting');

      // Connect wagmi if not already connected
      if (connections.length === 0) {
        const webAuthnConnector = connectors.find(
          (c) => c.id === 'webAuthn' || c.type === 'webAuthn'
        );
        if (!webAuthnConnector) {
          throw new Error('WebAuthn connector not available');
        }
        await connect.mutateAsync({ connector: webAuthnConnector });
      }

      setPhase('signing');

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

      const signature = await signMessage.mutateAsync({
        message: { raw: hash },
      });

      setPhase('processing');

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

      setPhase('success');
    } catch (err) {
      const classified = classifyWebAuthnError(err, 'sign', 'signing');
      setError(classified);
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
