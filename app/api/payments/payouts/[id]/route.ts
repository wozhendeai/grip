import { db } from '@/db';
import { getNetworkForInsert } from '@/db/network';
import { getBountyById } from '@/db/queries/bounties';
import { isOrgMember, validateOrgSpending, getOrgWalletAddress } from '@/db/queries/organizations';
import {
  getPayoutById,
  getPayoutWithDetails,
  markPayoutConfirmed,
  markPayoutFailed,
  updatePayoutStatus,
} from '@/db/queries/payouts';
import { getSubmissionById } from '@/db/queries/submissions';
import { getUserById } from '@/db/queries/users';
import { requireAuth } from '@/lib/auth/auth-server';
import { notifyPaymentReceived } from '@/lib/notifications';
import { buildPayoutTransaction } from '@/lib/tempo';
import { handleRouteError, validateBody } from '@/app/api/_lib';
import { payoutActionSchema } from '@/app/api/_lib/schemas';
import type { NextRequest } from 'next/server';

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
      canView = await isOrgMember(payout.payerOrganizationId, session.user.id);
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
 * Payout actions:
 * - action: 'confirm' - Confirm a payout transaction after broadcast
 * - action: 'release' - Prepare org payment release (returns tx params for signing)
 */
export async function POST(request: NextRequest, ctx: RouteContext<'/api/payments/payouts/[id]'>) {
  try {
    const session = await requireAuth();
    const { id: payoutId } = await ctx.params;
    const body = await validateBody(request, payoutActionSchema);

    if (body.action === 'confirm') {
      return handleConfirm(payoutId, session, body);
    }
    return handleRelease(payoutId, session);
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

  // Status validation
  const allowedStatuses = payout.payerOrganizationId
    ? ['awaiting_release', 'pending']
    : ['pending'];

  if (!payout.status || !allowedStatuses.includes(payout.status)) {
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

// ============================================================================
// Release action
// ============================================================================

async function handleRelease(payoutId: string, session: Session) {
  const payout = await getPayoutById(payoutId);

  if (!payout) {
    return Response.json({ error: 'Payout not found' }, { status: 404 });
  }

  if (payout.status !== 'awaiting_release') {
    return Response.json({ error: 'Payout is not awaiting release' }, { status: 400 });
  }

  if (!payout.payerOrganizationId) {
    return Response.json({ error: 'Payout is not an organization payment' }, { status: 400 });
  }

  // Verify org member with Access Key
  const validation = await validateOrgSpending({
    orgId: payout.payerOrganizationId,
    teamMemberUserId: session.user.id,
    tokenAddress: payout.tokenAddress,
    amount: payout.amount,
  });

  if (!validation.valid) {
    return Response.json(
      { error: validation.error || 'Not authorized to release payment' },
      { status: 403 }
    );
  }

  const orgWalletAddress = await getOrgWalletAddress(payout.payerOrganizationId);

  // Get bounty metadata for on-chain memo
  let issueNumber = 0;
  let prNumber = 0;
  let username = '';

  if (payout.bountyId) {
    const bounty = await getBountyById(payout.bountyId);
    if (bounty) issueNumber = bounty.githubIssueNumber;
  }

  if (payout.submissionId) {
    const submission = await getSubmissionById(payout.submissionId);
    if (submission?.githubPrNumber) prNumber = submission.githubPrNumber;

    const recipient = await getUserById(payout.recipientUserId);
    if (recipient?.name) username = recipient.name;
  }

  const txParams = buildPayoutTransaction({
    tokenAddress: payout.tokenAddress as `0x${string}`,
    recipientAddress: payout.recipientAddress as `0x${string}`,
    amount: payout.amount,
    issueNumber,
    prNumber,
    username,
  });

  return Response.json({
    message: 'Ready to release payment',
    payout: {
      id: payout.id,
      amount: payout.amount.toString(),
      recipientAddress: payout.recipientAddress,
      tokenAddress: payout.tokenAddress,
      status: payout.status,
    },
    txParams: {
      to: txParams.to,
      data: txParams.data,
      value: txParams.value.toString(),
    },
    signingAddress: orgWalletAddress,
  });
}
