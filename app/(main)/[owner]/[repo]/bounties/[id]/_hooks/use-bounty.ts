'use client';

import type { Bounty } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

type PayoutData = {
  id: string;
  amount: bigint;
  tokenAddress: string;
  recipientAddress: string;
  memo: string;
};

type ClaimantInfo = {
  id: string;
  name: string | null;
  address: string;
};

type PendingPaymentDetails = {
  amount: string;
  tokenAddress: string;
  recipientGithubUsername: string;
  recipientGithubUserId: string;
};

type ApproveResult =
  | { type: 'auto-signed'; txHash: string }
  | { type: 'manual-sign-required'; payout: PayoutData; claimant: ClaimantInfo }
  | { type: 'pending-signature-required'; payment: PendingPaymentDetails }
  | { type: 'pending-created'; claimUrl: string }
  | { type: 'error'; message: string };

type BountyState = {
  isApproving: boolean;
  isRejecting: boolean;
  isClaiming: boolean;
  error: string | null;
};

type UseBountyReturn = {
  // State
  state: BountyState;

  // Computed
  isPaid: boolean;
  activeSubmission: NonNullable<Bounty['submissions']>[number] | undefined;
  activeSubmissions: Bounty['submissions'];
  hasMultipleSubmissions: boolean;

  // Mutations
  approve: (
    submissionId?: string,
    signature?: { signature: string; authHash: string }
  ) => Promise<ApproveResult>;
  reject: (
    note: string,
    submissionId?: string
  ) => Promise<{ success: boolean; reopened?: boolean }>;
  claim: () => Promise<{ success: boolean; walletRequired?: boolean }>;

  // Helpers
  clearError: () => void;
};

export function useBounty(bounty: Bounty): UseBountyReturn {
  const router = useRouter();

  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Computed values
  const isPaid = bounty.status === 'completed';

  const activeSubmissions =
    bounty.submissions?.filter((s) => s.status === 'pending' || s.status === 'approved') ?? [];

  const activeSubmission = bounty.submissions?.find(
    (s) => s.status === 'pending' || s.status === 'approved' || s.status === 'merged'
  );

  const hasMultipleSubmissions = activeSubmissions.length > 1;

  const approve = useCallback(
    async (
      submissionId?: string,
      signature?: { signature: string; authHash: string }
    ): Promise<ApproveResult> => {
      setIsApproving(true);
      setError(null);

      try {
        const body: Record<string, unknown> = { action: 'approve' };
        if (submissionId) body.submissionId = submissionId;
        if (signature) {
          body.accessKeySignature = signature.signature;
          body.accessKeyAuthHash = signature.authHash;
        }

        const res = await fetch(`/api/bounties/${bounty.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();

        // Pending payment needs signature first
        if (data.requiresAccessKeySignature && data.payment) {
          return { type: 'pending-signature-required', payment: data.payment };
        }

        if (!res.ok) {
          const message = data.error || 'Failed to approve';
          setError(message);
          return { type: 'error', message };
        }

        // Auto-signed successfully
        if (data.autoSigned && data.payout?.txHash) {
          setTimeout(() => router.refresh(), 3000);
          return { type: 'auto-signed', txHash: data.payout.txHash };
        }

        // Manual signing required (contributor has wallet, but no Access Key)
        if (data.payout && data.contributor) {
          return {
            type: 'manual-sign-required',
            payout: {
              id: data.payout.id,
              amount: BigInt(data.payout.amount),
              tokenAddress: data.payout.tokenAddress,
              recipientAddress: data.payout.recipientAddress,
              memo: data.payout.memo,
            },
            claimant: data.contributor,
          };
        }

        // Pending payment created successfully
        if (data.pendingPayment?.claimUrl) {
          return { type: 'pending-created', claimUrl: data.pendingPayment.claimUrl };
        }

        // Fallback - refresh page
        router.refresh();
        return { type: 'error', message: 'Unknown response' };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to approve';
        setError(message);
        return { type: 'error', message };
      } finally {
        setIsApproving(false);
      }
    },
    [bounty.id, router]
  );

  const reject = useCallback(
    async (
      note: string,
      submissionId?: string
    ): Promise<{ success: boolean; reopened?: boolean }> => {
      if (!note.trim()) {
        setError('Please provide a rejection reason');
        return { success: false };
      }

      setIsRejecting(true);
      setError(null);

      try {
        const body: Record<string, unknown> = { action: 'reject', note };
        if (submissionId) body.submissionId = submissionId;

        const res = await fetch(`/api/bounties/${bounty.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Failed to reject');
          return { success: false };
        }

        router.refresh();
        return { success: true, reopened: data.reopened };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to reject';
        setError(message);
        return { success: false };
      } finally {
        setIsRejecting(false);
      }
    },
    [bounty.id, router]
  );

  const claim = useCallback(async (): Promise<{ success: boolean; walletRequired?: boolean }> => {
    setIsClaiming(true);
    setError(null);

    try {
      const res = await fetch(`/api/bounties/${bounty.id}/submit`, {
        method: 'POST',
      });
      const data = await res.json();

      if (data.error === 'WALLET_REQUIRED') {
        return { success: false, walletRequired: true };
      }

      if (!res.ok) {
        setError(data.error || 'Failed to submit for bounty');
        return { success: false };
      }

      router.refresh();
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit';
      setError(message);
      return { success: false };
    } finally {
      setIsClaiming(false);
    }
  }, [bounty.id, router]);

  const clearError = useCallback(() => setError(null), []);

  return {
    state: { isApproving, isRejecting, isClaiming, error },
    isPaid,
    activeSubmission,
    activeSubmissions,
    hasMultipleSubmissions,
    approve,
    reject,
    claim,
    clearError,
  };
}
