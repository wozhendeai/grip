'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PasskeyOperationContent } from '@/components/tempo';
import { getCurrentNetwork } from '@/db/network';
import { BACKEND_WALLET_ADDRESSES, TEMPO_TOKENS } from '@/lib/tempo/constants';
import {
  classifyWebAuthnError,
  type PasskeyOperationError,
  type PasskeyPhase,
} from '@/lib/webauthn';
import { useCallback, useState } from 'react';
import { KeyAuthorization } from 'ox/tempo';
import { useConnect, useConnections, useConnectors, useSignMessage } from 'wagmi';

type AccessKey = {
  id: string;
  backendWalletAddress: string | null;
  limits: Record<string, { initial: string; remaining: string }>;
  status: string;
  createdAt: string | null;
  lastUsedAt: string | null;
  label: string | null;
  expiry: number | null;
};

type CreateAccessKeyInlineProps = {
  onSuccess: (key: AccessKey) => void;
  onBack: () => void;
};

/**
 * Inline form for creating access keys - replaces main content to avoid nested modals
 */
export function CreateAccessKeyInline({ onSuccess, onBack }: CreateAccessKeyInlineProps) {
  const [phase, setPhase] = useState<PasskeyPhase>('ready');
  const [spendingLimit, setSpendingLimit] = useState('10000');
  const [error, setError] = useState<PasskeyOperationError | null>(null);

  const connectors = useConnectors();
  const connections = useConnections();
  const connect = useConnect();
  const signMessage = useSignMessage();

  const handleCreate = useCallback(async () => {
    setError(null);
    setPhase('connecting');

    try {
      // Connect if not already connected
      if (connections.length === 0) {
        const webAuthnConnector = connectors.find(
          (c) => c.id === 'webAuthn' || c.type === 'webAuthn'
        );

        if (!webAuthnConnector) {
          setError({
            type: 'unknown',
            message: 'WebAuthn connector not available. Please refresh and try again.',
            phase: 'connect',
          });
          setPhase('error');
          return;
        }

        await connect.mutateAsync({ connector: webAuthnConnector });
      }

      // Sign authorization
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
      const signature = await signMessage.mutateAsync({ message: { raw: hash } });

      // Create access key
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
        const data = await createRes.json().catch(() => ({}));
        setError({
          type: 'operation_failed',
          message: data.error || 'Failed to create Access Key. Please try again.',
          phase: 'process',
        });
        setPhase('error');
        return;
      }

      const { accessKey } = await createRes.json();
      setPhase('success');
      onSuccess(accessKey);
    } catch (err) {
      const currentPhase = phase === 'connecting' ? 'connect' : 'sign';
      const classified = classifyWebAuthnError(err, currentPhase, 'signing');
      setError(classified);
      setPhase('error');
    }
  }, [connections.length, connectors, connect, signMessage, spendingLimit, onSuccess, phase]);

  const handleRetry = useCallback(() => {
    setError(null);
    setPhase('ready');
  }, []);

  const canGoBack = !['connecting', 'signing', 'processing'].includes(phase);

  return (
    <div>
      {canGoBack && (
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 -ml-2">
          ← Back
        </Button>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Enable Auto-Pay</CardTitle>
          <CardDescription>
            Grant GRIP permission to automatically sign bounty payouts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PasskeyOperationContent
            phase={phase}
            error={error}
            operationType="signing"
            operationLabel="Access Key"
            onRetry={handleRetry}
            onCreateWallet={() => {
              window.location.href = '/settings/wallet';
            }}
            successMessage="Auto-Pay enabled!"
            educationalContent={
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <h4 className="font-medium">What is Auto-Pay?</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>- Automatically signs bounty payouts without manual approval</li>
                  <li>- You control spending limits and can revoke anytime</li>
                  <li>- Secured by Tempo's Account Keychain (on-chain authorization)</li>
                  <li>- Private keys never leave Turnkey's secure HSM</li>
                </ul>
              </div>
            }
          >
            {phase === 'ready' && (
              <div className="space-y-4">
                <Field>
                  <FieldLabel>Spending Limit (USDC)</FieldLabel>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={spendingLimit}
                    onChange={(e) => setSpendingLimit(e.target.value)}
                    placeholder="10000"
                  />
                  <FieldDescription>
                    Maximum amount in USDC that GRIP can spend on your behalf
                  </FieldDescription>
                </Field>

                <Button
                  onClick={handleCreate}
                  className="w-full"
                  disabled={!spendingLimit || Number(spendingLimit) <= 0}
                >
                  Sign & Enable Auto-Pay
                </Button>
              </div>
            )}
          </PasskeyOperationContent>
        </CardContent>
      </Card>
    </div>
  );
}
