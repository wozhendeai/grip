import { validateOrgSpending } from '@/db/queries/organizations';
import {
  getPayoutWithDetails,
  markPayoutConfirmed,
  markPayoutFailed,
  updatePayoutStatus,
} from '@/db/queries/payouts';
import { auth } from '@/lib/auth/auth';
import { requireAuth } from '@/lib/auth/auth-server';
import { notifyPaymentReceived } from '@/lib/notifications';
import { handleRouteError, validateBody } from '@/app/api/_lib';
import { payoutActionSchema } from '@/app/api/_lib/schemas';
import type { NextRequest } from 'next/server';
import { headers } from 'next/headers';

/**
 * GET /api/payments/payouts/[id]
 *
 * Check the confirmation status of a payout.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<'/api/payments/payouts/[id]'>) {
  try {
    const session = await requireAuth();
    const { id: payoutId } = await ctx.params;

    const payoutData = await getPayoutWithDetails(payoutId);
    if (!payoutData) {
      return Response.json({ error: 'Payout not found' }, { status: 404 });
    }

    const { payout, bounty } = payoutData;

    // Check user has permission to view this payout
    let canView = false;
    const isRecipient = payout.recipientUserId === session.user.id;

    if (payout.payerOrganizationId) {
      const headersList = await headers();
      const hasPermission = await auth.api.hasPermission({
        headers: headersList,
        body: { permissions: { member: ['read'] }, organizationId: payout.payerOrganizationId },
      });
      canView = !!hasPermission?.success;
    } else {
      canView = bounty.primaryFunderId === session.user.id;
    }

    if (!canView && !isRecipient) {
      return Response.json(
        { error: 'You do not have permission to view this payout' },
        { status: 403 }
      );
    }

    return Response.json({
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
    return handleRouteError(error, 'getting payout status');
  }
}

/**
 * POST /api/payments/payouts/[id]
 *
 * Confirm a payout transaction after broadcast.
 */
export async function POST(request: NextRequest, ctx: RouteContext<'/api/payments/payouts/[id]'>) {
  try {
    const session = await requireAuth();
    const { id: payoutId } = await ctx.params;
    const body = await validateBody(request, payoutActionSchema);

    return handleConfirm(payoutId, session, body);
  } catch (error) {
    return handleRouteError(error, 'processing payout action');
  }
}

// ============================================================================
// Confirm action
// ============================================================================

type Session = Awaited<ReturnType<typeof requireAuth>>;

async function handleConfirm(
  payoutId: string,
  session: Session,
  body: {
    action: 'confirm';
    txHash: string;
    status?: 'success' | 'reverted';
    blockNumber?: string | number;
  }
) {
  const payoutData = await getPayoutWithDetails(payoutId);
  if (!payoutData) {
    return Response.json({ error: 'Payout not found' }, { status: 404 });
  }

  const { payout, bounty } = payoutData;

  // Permission check
  let canConfirm = false;
  if (payout.payerOrganizationId) {
    const validation = await validateOrgSpending({
      orgId: payout.payerOrganizationId,
      teamMemberUserId: session.user.id,
      tokenAddress: payout.tokenAddress,
      amount: payout.amount,
    });
    canConfirm = validation.valid;
  } else {
    canConfirm = bounty.primaryFunderId === session.user.id;
  }

  if (!canConfirm) {
    return Response.json(
      { error: 'You do not have permission to confirm payouts for this bounty' },
      { status: 403 }
    );
  }

  // Status validation - only pending payouts can be confirmed
  if (payout.status !== 'pending') {
    return Response.json(
      { error: `Cannot confirm payout in ${payout.status} status` },
      { status: 400 }
    );
  }

  let updatedPayout = await updatePayoutStatus(payoutId, 'pending', { txHash: body.txHash });

  if (body.status === 'success' && body.blockNumber !== undefined) {
    updatedPayout = await markPayoutConfirmed(
      payoutId,
      body.txHash,
      typeof body.blockNumber === 'string' ? BigInt(body.blockNumber) : BigInt(body.blockNumber)
    );

    // Notify recipient (fire-and-forget)
    notifyPaymentReceived({
      recipientId: payout.recipientUserId,
      txHash: body.txHash,
      amount: payout.amount.toString(),
      tokenAddress: payout.tokenAddress,
      bountyTitle: bounty.title,
      repoFullName: bounty.githubFullName,
    }).catch((err) => console.error('[confirm] Notification failed:', err));

    return Response.json({
      message: 'Payment confirmed on-chain',
      payout: {
        id: updatedPayout?.id,
        status: updatedPayout?.status,
        txHash: updatedPayout?.txHash,
        blockNumber: updatedPayout?.blockNumber,
        confirmedAt: updatedPayout?.confirmedAt,
      },
      confirmation: { blockNumber: body.blockNumber, status: 'success' },
    });
  }

  if (body.status === 'reverted') {
    updatedPayout = await markPayoutFailed(payoutId, 'Transaction reverted on-chain');
    return Response.json({
      message: 'Transaction reverted',
      payout: {
        id: updatedPayout?.id,
        status: updatedPayout?.status,
        txHash: updatedPayout?.txHash,
        errorMessage: updatedPayout?.errorMessage,
      },
      confirmation: { blockNumber: body.blockNumber, status: 'reverted' },
    });
  }

  return Response.json({
    message: 'Transaction submitted successfully',
    payout: {
      id: updatedPayout?.id,
      status: updatedPayout?.status,
      txHash: updatedPayout?.txHash,
    },
  });
}
