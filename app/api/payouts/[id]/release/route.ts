import { db } from '@/db';
import { getNetworkForInsert } from '@/db/network';
import { getPayoutById } from '@/db/queries/payouts';
import { requireAuth } from '@/lib/auth/auth-server';
import { buildPayoutTransaction } from '@/lib/tempo';
import { type NextRequest, NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/payouts/[id]/release
 *
 * Release organization pending payment (team member signature required)
 *
 * Flow:
 * 1. Get payout by ID
 * 2. Validate status is 'awaiting_release' and payer is organization
 * 3. Verify requesting user is org member with Access Key
 * 4. Build transaction parameters
 * 5. Return tx params for client-side signing (team member's passkey)
 *
 * Why team member must sign:
 * - Access Keys are SUBORDINATE (cannot authorize other Access Keys)
 * - Only Root Key (owner's passkey) can create Access Keys
 * - Team member Access Keys can spend, but can't delegate to backend
 * - Solution: Team member signs release transaction directly with their org Access Key
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth();
    const { id: payoutId } = await context.params;

    // Get payout by ID
    const payout = await getPayoutById(payoutId);

    if (!payout) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
    }

    // Validate payout status
    if (payout.status !== 'awaiting_release') {
      return NextResponse.json({ error: 'Payout is not awaiting release' }, { status: 400 });
    }

    // Validate payer is organization
    if (!payout.payerOrganizationId) {
      return NextResponse.json({ error: 'Payout is not an organization payment' }, { status: 400 });
    }

    // Verify requesting user is org member with Access Key
    const { validateOrgSpending } = await import('@/db/queries/organizations');
    const validation = await validateOrgSpending({
      orgId: payout.payerOrganizationId,
      teamMemberUserId: session.user.id,
      tokenAddress: payout.tokenAddress,
      amount: payout.amount,
    });

    if (!validation.valid) {
      return NextResponse.json(
        {
          error: validation.error || 'Not authorized to release payment',
        },
        { status: 403 }
      );
    }

    // Get org wallet address (owner's passkey address)
    const { getOrgWalletAddress } = await import('@/db/queries/organizations');
    const orgWalletAddress = await getOrgWalletAddress(payout.payerOrganizationId);

    // Get bounty metadata for on-chain memo (if this is a bounty payment)
    let issueNumber = 0;
    let prNumber = 0;
    let username = '';

    if (payout.bountyId) {
      const { getBountyById } = await import('@/db/queries/bounties');
      const bounty = await getBountyById(payout.bountyId);
      if (bounty) {
        issueNumber = bounty.githubIssueNumber;
      }
    }

    if (payout.submissionId) {
      const { getSubmissionById } = await import('@/db/queries/submissions');
      const submission = await getSubmissionById(payout.submissionId);
      if (submission?.githubPrNumber) {
        prNumber = submission.githubPrNumber;
      }

      // Get recipient username
      const { getUserById } = await import('@/db/queries/users');
      const recipient = await getUserById(payout.recipientUserId);
      if (recipient?.name) {
        username = recipient.name;
      }
    }

    // Build transaction
    const txParams = buildPayoutTransaction({
      tokenAddress: payout.tokenAddress as `0x${string}`,
      recipientAddress: payout.recipientAddress as `0x${string}`,
      amount: payout.amount,
      issueNumber,
      prNumber,
      username,
    });

    // Return transaction params for client-side signing
    // Frontend should fetch a Tempo nonce lane (Actions.nonce.getNonce) before signing
    return NextResponse.json({
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
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[release] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to prepare release',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
