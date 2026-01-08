'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getExplorerTxUrl } from '@/lib/tempo/constants';
import { Check, ExternalLink, KeyRound, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Actions, Hooks } from 'wagmi/tempo';
import { formatUnits } from 'viem';
import { useConnection, useWaitForTransactionReceipt } from 'wagmi';
import { config } from '@/lib/wagmi-config';

/**
 * Payout Queue - SDK Version
 *
 * Migration from custom signing to SDK:
 * - BEFORE: Manual loop with signTempoTransaction + broadcastTransaction
 * - AFTER: Tempo Actions with explicit nonce lanes for parallel submission
 *
 * Note: We fetch nonces for each nonceKey and submit transfers without
 * waiting for confirmations, enabling parallel execution on-chain.
 */

interface PayoutQueueProps {
  githubRepoId: number;
}

interface PayoutItem {
  id: string;
  amount: number;
  tokenAddress: string;
  recipientAddress: string;
  memo: string;
  recipient: {
    id: string;
    name: string | null;
    address: string;
  };
  bounty: {
    id: string;
    title: string;
    issueNumber: number;
  };
}

export function PayoutQueue({ githubRepoId }: PayoutQueueProps) {
  const [loading, setLoading] = useState(false);
  const [signing, setSigning] = useState(false);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingPayoutIds, setPendingPayoutIds] = useState<string[]>([]);
  const [batchConfirmed, setBatchConfirmed] = useState(false);

  const { address } = useConnection();
  const { data: receipt, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash as `0x${string}` | undefined,
  });

  // Get user's fee token preference (protocol handles fallback if not set)
  const { data: userFeeToken } = Hooks.fee.useUserToken({
    account: address!,
    query: { enabled: Boolean(address) },
  });
  const feeToken = userFeeToken?.address; // undefined lets protocol handle fallback

  // Fetch pending payouts
  // Using useCallback because fetchPayouts is used in useEffect dependency array
  // Depends on githubRepoId from props - when githubRepoId changes, fetchPayouts is recreated
  const fetchPayouts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/repo-settings/${githubRepoId}/payouts/batch`);
      const data = await res.json();
      setPayouts(data.payouts || []);
      setSelectedIds(new Set((data.payouts || []).map((p: PayoutItem) => p.id)));
    } catch (err) {
      console.error('Error fetching payouts:', err);
    } finally {
      setLoading(false);
    }
  }, [githubRepoId]);

  useEffect(() => {
    if (!isConfirmed || !txHash || batchConfirmed || pendingPayoutIds.length === 0) {
      return;
    }
    if (!receipt?.blockNumber) {
      return;
    }

    setBatchConfirmed(true);
    fetch('/api/payments/payouts/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'mark-confirmed',
        payoutIds: pendingPayoutIds,
        txHash,
        blockNumber: receipt.blockNumber.toString(),
      }),
    })
      .then(() => fetchPayouts())
      .catch((err) => {
        console.error('Failed to mark batch confirmed:', err);
        setBatchConfirmed(false);
      });
  }, [isConfirmed, txHash, pendingPayoutIds, receipt?.blockNumber, batchConfirmed, fetchPayouts]);

  // Fetch on mount and when fetchPayouts changes (which happens when projectId changes)
  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  // Sign and broadcast batch with SDK
  // Sequential signing: SDK triggers WebAuthn for each transaction
  // SDK handles nonce incrementing automatically
  const handleBatchSign = async () => {
    setSigning(true);
    setError(null);

    try {
      // Filter selected payouts
      const selectedPayouts = payouts.filter((p) => selectedIds.has(p.id));

      if (selectedPayouts.length === 0) {
        throw new Error('No payouts selected');
      }
      if (!address) {
        throw new Error('Wallet not connected');
      }

      const nonceKeys = selectedPayouts.map((_, index) => BigInt(index + 1));
      const nonces = await Promise.all(
        nonceKeys.map((nonceKey) => Actions.nonce.getNonce(config, { account: address, nonceKey }))
      );

      const results = await Promise.all(
        selectedPayouts.map(async (payout, index) => {
          const nonceKey = nonceKeys[index];
          const nonce = nonces[index];
          const hash = await Actions.token.transfer(config, {
            amount: BigInt(payout.amount),
            to: payout.recipientAddress as `0x${string}`,
            token: payout.tokenAddress as `0x${string}`,
            memo: payout.memo as `0x${string}`,
            feeToken, // Use user's fee token preference
            nonceKey,
            nonce: Number(nonce),
          });

          return { payoutId: payout.id, txHash: hash };
        })
      );

      // Use first tx hash as batch identifier
      const batchTxHash = results[0].txHash;
      setTxHash(batchTxHash);
      setPendingPayoutIds(selectedPayouts.map((payout) => payout.id));
      setBatchConfirmed(false);

      // Confirm all payouts in database
      await fetch('/api/payments/payouts/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          payoutIds: Array.from(selectedIds),
          txHash: batchTxHash,
        }),
      });

      // Refresh list
      await fetchPayouts();
    } catch (err) {
      console.error('Batch signing error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSigning(false);
    }
  };

  const selectedCount = selectedIds.size;
  const totalAmount = payouts
    .filter((p) => selectedIds.has(p.id))
    .reduce((sum, p) => sum + p.amount, 0);

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading payouts...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (payouts.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center">No pending payouts</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Payouts ({payouts.length})</CardTitle>
        <CardDescription>Auto-approved payments ready to sign</CardDescription>
      </CardHeader>

      <CardContent className="space-y-2">
        {payouts.map((payout) => (
          <div
            key={payout.id}
            className="flex items-center gap-3 p-3 rounded-lg border border-border"
          >
            <input
              type="checkbox"
              checked={selectedIds.has(payout.id)}
              onChange={(e) => {
                const next = new Set(selectedIds);
                if (e.target.checked) next.add(payout.id);
                else next.delete(payout.id);
                setSelectedIds(next);
              }}
              className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-ring"
            />
            <div className="flex-1">
              <p className="font-medium">
                {payout.bounty.title} (#{payout.bounty.issueNumber})
              </p>
              <p className="text-sm text-muted-foreground">
                {payout.recipient.name} • ${formatUnits(BigInt(payout.amount), 6)} USDC
              </p>
            </div>
          </div>
        ))}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {txHash && (
          <div className="rounded-lg border border-success/30 bg-success/10 p-3">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-success" />
              <span className="text-sm">Batch payment sent!</span>
            </div>
            <a
              href={getExplorerTxUrl(txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1 mt-1"
            >
              View transaction <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{selectedCount} selected</p>
          <p className="font-medium">Total: ${formatUnits(BigInt(totalAmount), 6)} USDC</p>
        </div>

        <Button onClick={handleBatchSign} disabled={signing || selectedCount === 0}>
          {signing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing...
            </>
          ) : (
            <>
              <KeyRound className="mr-2 h-4 w-4" />
              Sign & Pay All ({selectedCount})
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
