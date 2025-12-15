'use client';

import { TokenAmount } from '@/components/tempo/token-amount';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getExplorerTxUrl } from '@/lib/tempo/constants';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Claim Payment Component
 *
 * Final step: user clicks to claim their payment.
 * Calls API endpoint which:
 * 1. Signs transaction with custodial wallet (Turnkey)
 * 2. Transfers funds to user's passkey wallet
 * 3. Uses Tempo fee sponsorship (backend pays gas)
 *
 * This is the "wow" moment - demonstrates Tempo's unique capabilities.
 */

type ClaimPaymentProps = {
  custodialWallet: {
    id: string;
    githubUsername: string;
    address: string;
    claimToken: string;
  };
  userWallet: {
    tempoAddress: string;
  };
};

export function ClaimPayment({ custodialWallet, userWallet }: ClaimPaymentProps) {
  const router = useRouter();
  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    txHashes: string[];
    totalAmount: string;
  } | null>(null);

  const handleClaim = async () => {
    try {
      setIsClaiming(true);
      setError(null);

      // Call claim API
      const response = await fetch(`/api/claim/${custodialWallet.claimToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? 'Failed to claim payment');
      }

      const data = await response.json();

      setSuccess({
        txHashes: data.transfers.map((t: { txHash: string }) => t.txHash),
        totalAmount: data.totalTransfers.toString(),
      });

      // Refresh to show success state
      setTimeout(() => {
        router.push('/wallet');
      }, 5000);
    } catch (err) {
      console.error('[claim-payment] Failed to claim:', err);
      setError(err instanceof Error ? err.message : 'Failed to claim payment');
    } finally {
      setIsClaiming(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md p-8">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <span className="text-3xl">✅</span>
            </div>

            <div className="gap-2">
              <h1 className="heading-2">Payment Claimed!</h1>
              <p className="body-base text-muted-foreground">
                Your funds have been transferred to your wallet.
              </p>
            </div>

            <div className="w-full gap-4">
              {success.txHashes.map((txHash, i) => (
                <div key={txHash} className="rounded-lg bg-muted p-4 gap-2">
                  <p className="body-sm text-muted-foreground">Transaction {i + 1}:</p>
                  <a
                    href={getExplorerTxUrl(txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="body-sm text-primary hover:underline break-all"
                  >
                    {txHash}
                  </a>
                </div>
              ))}
            </div>

            <p className="body-sm text-muted-foreground">Redirecting to your wallet...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <span className="text-3xl">💰</span>
          </div>

          <div className="gap-2">
            <h1 className="heading-2">Ready to Claim</h1>
            <p className="body-base text-muted-foreground">
              Transfer your payment from the secure custodial wallet to your passkey wallet.
            </p>
          </div>

          <div className="w-full gap-4">
            <div className="rounded-lg bg-muted p-4 gap-2">
              <p className="body-sm text-muted-foreground">From (Custodial Wallet):</p>
              <p className="font-mono body-sm break-all">{custodialWallet.address}</p>
            </div>

            <div className="flex justify-center">
              <span className="text-2xl">↓</span>
            </div>

            <div className="rounded-lg bg-primary/10 p-4 gap-2">
              <p className="body-sm text-muted-foreground">To (Your Wallet):</p>
              <p className="font-mono body-sm break-all">{userWallet.tempoAddress}</p>
            </div>
          </div>

          {error && (
            <div className="w-full rounded-lg bg-destructive/10 p-4">
              <p className="body-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="w-full gap-4">
            <Button onClick={handleClaim} disabled={isClaiming} className="w-full" size="lg">
              {isClaiming ? 'Claiming Payment...' : 'Claim Payment'}
            </Button>

            <div className="rounded-lg bg-accent/10 p-4 gap-2 text-left">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary">Powered by Tempo</Badge>
              </div>
              <p className="body-sm text-muted-foreground">
                <strong>Zero gas fees:</strong> Backend pays transaction fees via Tempo fee
                sponsorship. You receive the full amount.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
