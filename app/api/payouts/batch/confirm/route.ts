import { updatePayoutStatus } from '@/db/queries/payouts';
import { requireAuth } from '@/lib/auth/auth-server';
import { type NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const { payoutIds, txHash } = body;

    if (!payoutIds || !Array.isArray(payoutIds) || !txHash) {
      return NextResponse.json({ error: 'payoutIds and txHash required' }, { status: 400 });
    }

    // Update all payouts to pending with txHash
    await Promise.all(payoutIds.map((id: string) => updatePayoutStatus(id, 'pending', { txHash })));

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
