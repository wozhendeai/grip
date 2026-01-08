import { getPayoutWithDetails, updatePayoutStatus } from '@/db/queries/payouts';
import { requireAuth } from '@/lib/auth/auth-server';
import { notifyPaymentReceived } from '@/lib/notifications';
import { handleRouteError, validateBody } from '@/app/api/_lib';
import { batchPayoutActionSchema } from '@/app/api/_lib/schemas';
import type { NextRequest } from 'next/server';

/**
 * POST /api/payments/payouts/batch
 *
 * Batch payout actions:
 * - action: 'confirm' - Submit txHash after broadcast, status → 'pending'
 * - action: 'mark-confirmed' - Mark as confirmed after receipt, status → 'confirmed'
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await validateBody(request, batchPayoutActionSchema);

    if (body.action === 'confirm') {
      const { payoutIds, txHash } = body;
      await Promise.all(payoutIds.map((id) => updatePayoutStatus(id, 'pending', { txHash })));
      return Response.json({ success: true, txHash, count: payoutIds.length });
    }

    // action: 'mark-confirmed'
    const { payoutIds, txHash, blockNumber } = body;
    const normalizedBlockNumber = String(blockNumber);

    await Promise.all(
      payoutIds.map((id) =>
        updatePayoutStatus(id, 'confirmed', {
          txHash,
          blockNumber: normalizedBlockNumber,
          confirmedAt: new Date().toISOString(),
        })
      )
    );

    // Send payment notifications (fire-and-forget)
    sendPaymentNotifications(payoutIds, txHash).catch((err) =>
      console.error('[batch] Notifications failed:', err)
    );

    return Response.json({ success: true, txHash, count: payoutIds.length });
  } catch (error) {
    return handleRouteError(error, 'processing batch payout');
  }
}

async function sendPaymentNotifications(payoutIds: string[], txHash: string) {
  await Promise.all(
    payoutIds.map(async (id) => {
      const payoutData = await getPayoutWithDetails(id);
      if (payoutData) {
        const { payout, bounty } = payoutData;
        await notifyPaymentReceived({
          recipientId: payout.recipientUserId,
          txHash,
          amount: payout.amount.toString(),
          tokenAddress: payout.tokenAddress,
          bountyTitle: bounty.title,
          repoFullName: bounty.githubFullName,
        });
      }
    })
  );
}
