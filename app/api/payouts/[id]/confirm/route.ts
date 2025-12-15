import { requireAuth } from '@/lib/auth-server';
import {
  getPayoutById,
  getPayoutWithDetails,
  markPayoutConfirmed,
  markPayoutFailed,
  updatePayoutStatus,
} from '@/lib/db/queries/payouts';
import { notifyPaymentReceived } from '@/lib/notifications';
import { waitForConfirmation } from '@/lib/tempo/signing';
import { type NextRequest, NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/payouts/[id]/confirm
 *
 * Confirm a payout transaction after it's been broadcast.
 * Updates the payout status with the transaction hash and waits for confirmation.
 *
 * Body:
 * - txHash: The transaction hash from broadcasting
 * - waitForConfirmation: Whether to wait for blockchain confirmation (optional, default false)
 *
 * Returns:
 * - payout: Updated payout record
 * - confirmation: Confirmation details (if waitForConfirmation=true)
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth();
    const { id: payoutId } = await context.params;

    const body = await request.json();
    const { txHash, waitForConfirmation: shouldWait = false } = body;

    if (!txHash || typeof txHash !== 'string') {
      return NextResponse.json({ error: 'txHash is required' }, { status: 400 });
    }

    // Validate txHash format
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return NextResponse.json({ error: 'Invalid transaction hash format' }, { status: 400 });
    }

    // Get payout with bounty details (needed for notification)
    const payoutData = await getPayoutWithDetails(payoutId);
    if (!payoutData) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
    }

    const { payout, bounty } = payoutData;

    // Check user has permission to confirm this payout
    // Primary funder controls approvals and payouts
    const canApprove = bounty.primaryFunderId === session.user.id;

    if (!canApprove) {
      return NextResponse.json(
        { error: 'You do not have permission to confirm payouts for this bounty' },
        { status: 403 }
      );
    }

    // Check payout is in pending status
    if (payout.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot confirm payout in ${payout.status} status` },
        { status: 400 }
      );
    }

    // Mark as pending with txHash (status stays 'pending' until confirmed)
    let updatedPayout = await updatePayoutStatus(payoutId, 'pending', { txHash });

    // Wait for confirmation if requested
    if (shouldWait) {
      try {
        const confirmation = await waitForConfirmation(txHash, 60000, 2000);

        if (confirmation.status === 'success') {
          updatedPayout = await markPayoutConfirmed(
            payoutId,
            txHash,
            BigInt(confirmation.blockNumber)
          );

          // Notify recipient that payment was received
          // Wrapped in try-catch to not block payout flow if notification fails
          try {
            await notifyPaymentReceived({
              recipientId: payout.recipientUserId,
              txHash,
              amount: payout.amount.toString(),
              tokenAddress: payout.tokenAddress,
              bountyTitle: bounty.title,
              repoFullName: bounty.githubFullName,
            });
          } catch (error) {
            console.error('[confirm] Failed to create payment received notification:', error);
          }

          return NextResponse.json({
            message: 'Payment confirmed on-chain',
            payout: {
              id: updatedPayout?.id,
              status: updatedPayout?.status,
              txHash: updatedPayout?.txHash,
              blockNumber: updatedPayout?.blockNumber,
              confirmedAt: updatedPayout?.confirmedAt,
            },
            confirmation: {
              blockNumber: confirmation.blockNumber,
              status: confirmation.status,
            },
          });
        }
        // Transaction reverted
        updatedPayout = await markPayoutFailed(payoutId, 'Transaction reverted on-chain');
        return NextResponse.json({
          message: 'Transaction reverted',
          payout: {
            id: updatedPayout?.id,
            status: updatedPayout?.status,
            txHash: updatedPayout?.txHash,
            errorMessage: updatedPayout?.errorMessage,
          },
          confirmation: {
            blockNumber: confirmation.blockNumber,
            status: confirmation.status,
          },
        });
      } catch (confirmError) {
        // Confirmation timed out or failed - payout stays in 'submitted' status
        // It can be confirmed later via a background job or retry
        console.error('Confirmation error:', confirmError);
        return NextResponse.json({
          message: 'Transaction submitted, confirmation pending',
          payout: {
            id: updatedPayout?.id,
            status: updatedPayout?.status,
            txHash: updatedPayout?.txHash,
          },
          warning: 'Confirmation timed out. The transaction may still confirm.',
        });
      }
    }

    return NextResponse.json({
      message: 'Transaction submitted successfully',
      payout: {
        id: updatedPayout?.id,
        status: updatedPayout?.status,
        txHash: updatedPayout?.txHash,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error confirming payout:', error);
    return NextResponse.json({ error: 'Failed to confirm payout' }, { status: 500 });
  }
}

/**
 * GET /api/payouts/[id]/confirm
 *
 * Check the confirmation status of a payout.
 * Useful for polling after a transaction has been submitted.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth();
    const { id: payoutId } = await context.params;

    const payoutData = await getPayoutWithDetails(payoutId);
    if (!payoutData) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
    }

    const { payout, bounty } = payoutData;

    // Check user has permission to view this payout
    // Primary funder or recipient can view
    const canApprove = bounty.primaryFunderId === session.user.id;
    const isRecipient = payout.recipientUserId === session.user.id;
    if (!canApprove && !isRecipient) {
      return NextResponse.json(
        { error: 'You do not have permission to view this payout' },
        { status: 403 }
      );
    }

    // If pending with txHash but not confirmed, try to get confirmation
    if (payout.status === 'pending' && payout.txHash) {
      try {
        const confirmation = await waitForConfirmation(payout.txHash, 5000, 1000);

        if (confirmation.status === 'success') {
          const updatedPayout = await markPayoutConfirmed(
            payoutId,
            payout.txHash,
            BigInt(confirmation.blockNumber)
          );

          // Notify recipient that payment was received
          // Wrapped in try-catch to not block status check if notification fails
          try {
            await notifyPaymentReceived({
              recipientId: payout.recipientUserId,
              txHash: payout.txHash,
              amount: payout.amount.toString(),
              tokenAddress: payout.tokenAddress,
              bountyTitle: bounty.title,
              repoFullName: bounty.githubFullName,
            });
          } catch (error) {
            console.error('[confirm-get] Failed to create payment received notification:', error);
          }

          return NextResponse.json({
            payout: {
              id: updatedPayout?.id,
              status: updatedPayout?.status,
              txHash: updatedPayout?.txHash,
              blockNumber: updatedPayout?.blockNumber,
              confirmedAt: updatedPayout?.confirmedAt,
            },
            confirmation: {
              blockNumber: confirmation.blockNumber,
              status: confirmation.status,
            },
          });
        }
        if (confirmation.status === 'reverted') {
          const updatedPayout = await markPayoutFailed(payoutId, 'Transaction reverted');
          return NextResponse.json({
            payout: {
              id: updatedPayout?.id,
              status: updatedPayout?.status,
              txHash: updatedPayout?.txHash,
              errorMessage: updatedPayout?.errorMessage,
            },
            confirmation: {
              blockNumber: confirmation.blockNumber,
              status: confirmation.status,
            },
          });
        }
      } catch {
        // Still pending, return current status
      }
    }

    return NextResponse.json({
      payout: {
        id: payout.id,
        status: payout.status,
        txHash: payout.txHash,
        blockNumber: payout.blockNumber,
        confirmedAt: payout.confirmedAt,
        errorMessage: payout.errorMessage,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error getting payout status:', error);
    return NextResponse.json({ error: 'Failed to get payout status' }, { status: 500 });
  }
}
