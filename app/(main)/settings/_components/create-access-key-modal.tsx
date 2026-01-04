'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasskeyOperationContent, getPasskeyTitle } from '@/components/passkey';
import { getCurrentNetwork } from '@/db/network';
import { BACKEND_WALLET_ADDRESSES, TEMPO_TOKENS } from '@/lib/tempo/constants';
import {
  classifyWebAuthnError,
  type PasskeyOperationError,
  type PasskeyPhase,
} from '@/lib/webauthn';
import { useCallback, useState } from 'react';
import { KeyAuthorization } from 'tempo.ts/ox';
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

type CreateAccessKeyModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (key: AccessKey) => void;
};

export function CreateAccessKeyModal({ open, onOpenChange, onSuccess }: CreateAccessKeyModalProps) {
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
      console.log('[Access Key] Starting creation flow');
      console.log('[Access Key] Current connections:', connections.length);

      // Connect if not already connected
      if (connections.length === 0) {
        console.log('[Access Key] No active connection, connecting...');

        const webAuthnConnector = connectors.find(
          (c) => c.id === 'webAuthn' || c.type === 'webAuthn'
        );

        console.log('[Access Key] Found webAuthn connector:', !!webAuthnConnector);

        if (!webAuthnConnector) {
          setError({
            type: 'unknown',
            message: 'WebAuthn connector not available. Please refresh and try again.',
            phase: 'connect',
          });
          setPhase('error');
          return;
        }

        console.log('[Access Key] Calling connect.mutateAsync()...');
        await connect.mutateAsync({ connector: webAuthnConnector });
        console.log('[Access Key] ✅ Connected successfully');
      } else {
        console.log('[Access Key] Already connected, skipping connection');
      }

      // Sign authorization
      setPhase('signing');
      console.log('[Access Key] Starting signing phase...');

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
      console.log('[Access Key] Calling signMessage.mutateAsync()...');

      // TODO: Credential targeting issue - if user has multiple passkeys in browser but only
      // one in DB, the Tempo SDK might show all passkeys instead of the correct one.
      // Solution: Fetch credentialID from DB and update localStorage['webAuthn.lastActiveCredential']
      // before signing to ensure SDK targets the correct credential.
      // See: tempo.ts/src/wagmi/Connector.ts line 377
      const signature = await signMessage.mutateAsync({ message: { raw: hash } });
      console.log('[Access Key] ✅ Signed successfully');

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
            // TODO: Check this
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

      setTimeout(() => {
        onOpenChange(false);
        setPhase('ready');
        setError(null);
      }, 2000);
    } catch (err) {
      console.error('[Access Key] ❌ Error occurred:', err);
      console.error(
        '[Access Key] Error type:',
        err instanceof Error ? err.constructor.name : typeof err
      );
      console.error(
        '[Access Key] Error message:',
        err instanceof Error ? err.message : String(err)
      );

      // Classify error based on current phase
      const currentPhase = phase === 'connecting' ? 'connect' : 'sign';
      const classified = classifyWebAuthnError(err, currentPhase, 'signing');

      console.error('[Access Key] Classified as:', classified.type);
      console.error('[Access Key] User message:', classified.message);

      setError(classified);
      setPhase('error');
    }
  }, [
    connections.length,
    connectors,
    connect,
    signMessage,
    spendingLimit,
    onSuccess,
    onOpenChange,
    phase,
  ]);

  const handleClose = useCallback(
    (newOpen: boolean) => {
      // Prevent closing during active operations
      const canClose = !['connecting', 'signing', 'registering', 'processing'].includes(phase);

      if (!newOpen && !canClose) {
        return;
      }

      onOpenChange(newOpen);

      // Reset state after close
      if (!newOpen) {
        setTimeout(() => {
          setPhase('ready');
          setError(null);
          setSpendingLimit('10000');
        }, 300);
      }
    },
    [phase, onOpenChange]
  );

  const handleRetry = useCallback(() => {
    setError(null);
    setPhase('ready');
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{getPasskeyTitle(phase, error, 'signing', 'Access Key')}</DialogTitle>
        </DialogHeader>

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
              <h4 className="heading-4">What is Auto-Pay?</h4>
              <ul className="body-sm text-muted-foreground space-y-1">
                <li>• Automatically signs bounty payouts without manual approval</li>
                <li>• You control spending limits and can revoke anytime</li>
                <li>• Secured by Tempo's Account Keychain (on-chain authorization)</li>
                <li>• Private keys never leave Turnkey's secure HSM</li>
              </ul>
            </div>
          }
        >
          {/* Custom ready-state content */}
          {phase === 'ready' && (
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
                  Maximum amount in USDC that GRIP can spend on your behalf
                </p>
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
        </PasskeyOperationContent>
      </DialogContent>
    </Dialog>
  );
}
