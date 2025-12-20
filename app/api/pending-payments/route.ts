import { getPendingPaymentsByFunder } from '@/db/queries/pending-payments';
import { requireAuth } from '@/lib/auth/auth-server';
import { NextResponse } from 'next/server';

/**
 * GET /api/pending-payments
 *
 * Returns list of funder's pending payments for wallet page display.
 * Includes bounty context (title, repo) where applicable.
 *
 * Design Decision: Separate endpoint instead of adding to /api/wallet
 * - Keeps wallet API focused on balance/activity
 * - Allows future expansion (filters, pagination)
 * - Follows REST pattern: resource-based routes
 */
export async function GET() {
  try {
    // 1. Require authentication
    const session = await requireAuth();

    // 2. Get funder's pending payments
    const payments = await getPendingPaymentsByFunder(session.user.id);

    // 3. Format response (serialize BigInts)
    const formattedPayments = payments.map((p) => ({
      id: p.id,
      amount: p.amount.toString(),
      tokenAddress: p.tokenAddress,
      recipientGithubUsername: p.recipientGithubUsername,
      recipientGithubUserId: p.recipientGithubUserId?.toString(),
      bountyId: p.bountyId,
      submissionId: p.submissionId,
      status: p.status,
      createdAt: p.createdAt,
      claimExpiresAt: p.claimExpiresAt,
      claimToken: p.claimToken,
      // Bounty context (null for direct payments)
      bountyTitle: p.bountyTitle,
      bountyGithubFullName: p.bountyGithubFullName,
    }));

    return NextResponse.json({
      pendingPayments: formattedPayments,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.error('[list-pending-payments] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch pending payments' }, { status: 500 });
  }
}
