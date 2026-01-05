import { getPayoutWithDetails, updatePayoutStatus } from '@/db/queries/payouts';
import { requireAuth } from '@/lib/auth/auth-server';
import { notifyPaymentReceived } from '@/lib/notifications';
import { type NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const { payoutIds, txHash, blockNumber } = body as {
      payoutIds?: string[];
      txHash?: string;
      blockNumber?: string | number;
    };

    if (!payoutIds || !Array.isArray(payoutIds) || !txHash || blockNumber === undefined) {
      return NextResponse.json(
        { error: 'payoutIds, txHash, and blockNumber required' },
        { status: 400 }
      );
    }

    const normalizedBlockNumber =
      typeof blockNumber === 'number' ? String(blockNumber) : blockNumber;

    await Promise.all(
      payoutIds.map((id: string) =>
        updatePayoutStatus(id, 'confirmed', {
          txHash,
          blockNumber: normalizedBlockNumber,
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
      console.error(
        '[batch-mark-confirmed] Failed to create payment received notifications:',
        error
      );
    }

    return NextResponse.json({
      success: true,
      txHash,
      count: payoutIds.length,
    });
  } catch (error) {
    console.error('Error marking batch confirmed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
