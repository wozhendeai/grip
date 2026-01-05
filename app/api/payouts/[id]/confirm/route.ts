import {
  getPayoutById,
  getPayoutWithDetails,
  markPayoutConfirmed,
  markPayoutFailed,
  updatePayoutStatus,
} from '@/db/queries/payouts';
import { requireAuth } from '@/lib/auth/auth-server';
import { notifyPaymentReceived } from '@/lib/notifications';
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
 * - status: Optional client-side receipt status ('success' | 'reverted')
 * - blockNumber: Optional confirmed block number (required with status='success')
 *
 * Returns:
 * - payout: Updated payout record
 * - confirmation: Confirmation details (if provided by client)
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth();
    const { id: payoutId } = await context.params;

    const body = await request.json();
    const { txHash, blockNumber, status } = body as {
      txHash?: string;
      blockNumber?: string | number;
      status?: 'success' | 'reverted';
    };

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
    // Support both personal and org payments
    let canConfirm = false;

    if (payout.payerOrganizationId) {
      // Org payment: Validate Access Key (consistent with /release endpoint)
      const { validateOrgSpending } = await import('@/db/queries/organizations');
      const validation = await validateOrgSpending({
        orgId: payout.payerOrganizationId,
        teamMemberUserId: session.user.id,
        tokenAddress: payout.tokenAddress,
        amount: payout.amount,
      });
      canConfirm = validation.valid;
    } else {
      // Personal payment: Check if user is the funder
      canConfirm = bounty.primaryFunderId === session.user.id;
    }

    if (!canConfirm) {
      return NextResponse.json(
        { error: 'You do not have permission to confirm payouts for this bounty' },
        { status: 403 }
      );
    }

    // Check payout status
    // Org payments: allow 'awaiting_release' (first confirm) or 'pending' (retries)
    // Personal payments: allow 'pending' only
    const allowedStatuses = payout.payerOrganizationId
      ? ['awaiting_release', 'pending']
      : ['pending'];

    if (!payout.status || !allowedStatuses.includes(payout.status)) {
      return NextResponse.json(
        { error: `Cannot confirm payout in ${payout.status} status` },
        { status: 400 }
      );
    }

    // Mark as pending with txHash (status stays 'pending' until confirmed)
    let updatedPayout = await updatePayoutStatus(payoutId, 'pending', { txHash });

    if (status === 'success' && blockNumber !== undefined) {
      updatedPayout = await markPayoutConfirmed(
        payoutId,
        txHash,
        typeof blockNumber === 'string' ? BigInt(blockNumber) : BigInt(blockNumber)
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
          blockNumber,
          status: 'success',
        },
      });
    }

    if (status === 'reverted') {
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
          blockNumber,
          status: 'reverted',
        },
      });
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
    // Support both personal and org payments
    let canView = false;
    const isRecipient = payout.recipientUserId === session.user.id;

    if (payout.payerOrganizationId) {
      // Org payment: Check if user is org member
      const { isOrgMember } = await import('@/db/queries/organizations');
      canView = await isOrgMember(payout.payerOrganizationId, session.user.id);
    } else {
      // Personal payment: Check if user is the funder
      canView = bounty.primaryFunderId === session.user.id;
    }

    if (!canView && !isRecipient) {
      return NextResponse.json(
        { error: 'You do not have permission to view this payout' },
        { status: 403 }
      );
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
