import { cancelPendingPayment } from '@/db/queries/pending-payments';
import { requireAuth } from '@/lib/auth/auth-server';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/pending-payments/[id]/cancel
 *
 * Cancels a pending payment and revokes its dedicated Access Key.
 *
 * Authorization: Only the funder can cancel their own pending payments
 * Validation: Can only cancel payments with status='pending'
 *
 * Design Decision: POST instead of DELETE
 * - This is a state transition (pending → cancelled), not resource deletion
 * - Preserves record for audit trail and history
 * - Follows REST pattern: DELETE removes resource, POST triggers action
 *
 * Security: Uses same pattern as bounty approval
 * - requireAuth() ensures user is logged in
 * - cancelPendingPayment() checks funderId matches session.user.id
 * - Status validation prevents cancelling already claimed payments
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // 1. Require authentication
    const session = await requireAuth();

    // 2. Get payment ID from URL
    const { id } = await params;

    // 3. Cancel payment (includes ownership and status validation)
    // Throws error if:
    // - Payment not found
    // - Not the funder (funderId !== session.user.id)
    // - Status is not 'pending' (already claimed/cancelled)
    const payment = await cancelPendingPayment(id, session.user.id);

    return NextResponse.json({
      success: true,
      message: 'Payment cancelled successfully',
      payment: {
        id: payment.id,
        status: 'cancelled',
        amount: payment.amount.toString(),
        recipientGithubUsername: payment.recipientGithubUsername,
      },
    });
  } catch (error) {
    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message === 'Payment not found or cannot be cancelled') {
        return NextResponse.json(
          { error: 'Payment not found, already cancelled, or you do not have permission' },
          { status: 404 }
        );
      }
    }

    console.error('[cancel-pending-payment] Error:', error);
    return NextResponse.json({ error: 'Failed to cancel payment' }, { status: 500 });
  }
}
