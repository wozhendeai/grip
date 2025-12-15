import { requireAuth } from '@/lib/auth-server';
import { getPayoutWithDetails, updatePayoutStatus } from '@/lib/db/queries/payouts';
import { notifyPaymentReceived } from '@/lib/notifications';
import { waitForConfirmation } from '@/lib/tempo/signing';
import { type NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const { payoutIds, txHash } = body;

    if (!payoutIds || !Array.isArray(payoutIds) || !txHash) {
      return NextResponse.json({ error: 'payoutIds and txHash required' }, { status: 400 });
    }

    // Update all payouts to pending with txHash
    await Promise.all(payoutIds.map((id: string) => updatePayoutStatus(id, 'pending', { txHash })));

    // Optionally wait for confirmation
    try {
      const receipt = await waitForConfirmation(txHash, 30000);
      if (receipt) {
        // Update to confirmed
        await Promise.all(
          payoutIds.map((id: string) =>
            updatePayoutStatus(id, 'confirmed', {
              blockNumber: BigInt(receipt.blockNumber),
              confirmedAt: new Date().toISOString(),
            })
          )
        );

        // Send payment received notifications to all recipients
        // Wrapped in try-catch to not block batch confirmation if notifications fail
        try {
          await Promise.all(
            payoutIds.map(async (id: string) => {
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
        } catch (error) {
          console.error('[batch-confirm] Failed to create payment received notifications:', error);
        }
      }
    } catch (error) {
      console.warn('Confirmation wait failed, payouts marked as submitted:', error);
    }

    return NextResponse.json({
      success: true,
      txHash,
      count: payoutIds.length,
    });
  } catch (error) {
    console.error('Error confirming batch:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
