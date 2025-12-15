'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Create Wallet For Claim Component
 *
 * Prompts authenticated users to create a passkey wallet before claiming.
 * Uses better-auth passkey plugin + tempo plugin for P256 address derivation.
 */

type CreateWalletForClaimProps = {
  custodialWallet: {
    githubUsername: string;
    address: string;
  };
  claimToken: string;
};

export function CreateWalletForClaim({ custodialWallet, claimToken }: CreateWalletForClaimProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateWallet = async () => {
    try {
      setIsCreating(true);
      setError(null);

      // Create passkey (better-auth passkey plugin + tempo plugin)
      // This will:
      // 1. Trigger WebAuthn credential creation (biometric/security key)
      // 2. Derive Tempo address from P256 public key (tempo plugin)
      // 3. Store passkey + tempoAddress in database
      const result = await authClient.passkey.addPasskey();

      if (result.error) {
        throw new Error(result.error.message ?? 'Failed to create wallet');
      }

      // Refresh page to show claim button
      router.refresh();
    } catch (err) {
      console.error('[create-wallet] Failed to create wallet:', err);
      setError(err instanceof Error ? err.message : 'Failed to create wallet');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <span className="text-3xl">🔐</span>
          </div>

          <div className="gap-2">
            <h1 className="heading-2">Create Your Wallet</h1>
            <p className="body-base text-muted-foreground">
              Create a passkey wallet to claim your payment. Your payment is securely held and
              waiting for you.
            </p>
          </div>

          <div className="w-full rounded-lg bg-muted p-4 gap-2">
            <p className="body-sm text-muted-foreground">Payment for:</p>
            <p className="body-base font-medium">@{custodialWallet.githubUsername}</p>
            <p className="body-sm text-muted-foreground mt-2">Held in secure wallet:</p>
            <p className="font-mono body-sm break-all">{custodialWallet.address}</p>
          </div>

          {error && (
            <div className="w-full rounded-lg bg-destructive/10 p-4">
              <p className="body-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="w-full gap-4">
            <Button onClick={handleCreateWallet} disabled={isCreating} className="w-full" size="lg">
              {isCreating ? 'Creating Wallet...' : 'Create Wallet with Passkey'}
            </Button>

            <div className="rounded-lg bg-accent/10 p-4 gap-2 text-left">
              <p className="body-sm font-medium">What's a passkey wallet?</p>
              <ul className="list-disc list-inside body-sm text-muted-foreground gap-1">
                <li>Uses your device's biometric (Face ID, fingerprint, etc.)</li>
                <li>No passwords or seed phrases to remember</li>
                <li>Your keys never leave your device</li>
                <li>Built on Web3 standards (P256 + Tempo blockchain)</li>
              </ul>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
