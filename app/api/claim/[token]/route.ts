import { db } from '@/db';
import { getNetworkForInsert } from '@/db/network';
import { getUserWallet } from '@/db/queries/passkeys';
import { createPayout, updatePayoutStatus } from '@/db/queries/payouts';
import { accessKeys } from '@/db/schema/business';
import { requireAuth } from '@/lib/auth/auth-server';
import { buildPayoutTransaction } from '@/lib/tempo';
import { tempoClient } from '@/lib/tempo/client';
import { broadcastTransaction, signTransactionWithAccessKey } from '@/lib/tempo/keychain-signing';
import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ token: string }>;
};

/**
 * POST /api/claim/[token]
 *
 * Claim pending payment and transfer from funder's wallet to user's passkey wallet.
 *
 * KEY TEMPO FEATURES DEMONSTRATED:
 * 1. Access Keys - Funder pre-authorized payment with dedicated Access Key
 * 2. Fee sponsorship - Payment execution pays gas in tokens being transferred
 * 3. Payment lanes - Guaranteed low fees (~$0.001 via TIP-20)
 * 4. Batched payments - Multiple pending payments claimed at once
 * 5. Non-custodial - Funds stay in funder's wallet until claim (no custody)
 *
 * Flow:
 * 1. Verify claim token and user authentication
 * 2. Find ALL pending payments for this GitHub user
 * 3. For each pending payment:
 *    a. Get funder's wallet and dedicated Access Key
 *    b. Sign transfer with Access Key (from funder's wallet)
 *    c. Broadcast transaction to Tempo
 *    d. Create payout record
 *    e. Mark pending payment as claimed
 *    f. Revoke dedicated Access Key (single-use)
 *
 * Why this is better than custodial wallets:
 * - Funds never leave funder's control until claim
 * - No intermediate custody (reduced attack surface)
 * - Funder retains full control (can cancel if balance insufficient)
 * - Access Keys provide granular, auditable spending limits
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth();
    const { token } = await context.params;

    // Get pending payment
    const { getPendingPaymentByClaimToken } = await import('@/db/queries/pending-payments');
    const pendingPayment = await getPendingPaymentByClaimToken(token);

    if (!pendingPayment) {
      return NextResponse.json({ error: 'Invalid claim token' }, { status: 404 });
    }

    // Validate status
    if (pendingPayment.status !== 'pending') {
      return NextResponse.json({ error: 'Payment already claimed or expired' }, { status: 400 });
    }

    // Check expiration
    if (new Date() > new Date(pendingPayment.claimExpiresAt)) {
      return NextResponse.json({ error: 'Claim link expired (1 year limit)' }, { status: 400 });
    }

    // Verify GitHub identity matches (security: prevents claim token theft)
    // session.user.githubUserId populated during GitHub OAuth in lib/auth/auth.ts
    const userGithubId = (session.user as { githubUserId?: bigint }).githubUserId;
    if (userGithubId !== pendingPayment.recipientGithubUserId) {
      return NextResponse.json({ error: 'GitHub account mismatch' }, { status: 403 });
    }

    // Get user's wallet
    const userWallet = await getUserWallet(session.user.id);
    if (!userWallet?.tempoAddress) {
      return NextResponse.json(
        { error: 'Please create a passkey wallet before claiming' },
        { status: 400 }
      );
    }

    // Batch claiming: Get ALL pending payments for this GitHub user
    const { getPendingPaymentsByGithubUser } = await import('@/db/queries/pending-payments');
    const allPending = await getPendingPaymentsByGithubUser(
      Number(pendingPayment.recipientGithubUserId)
    );

    console.log(`[claim] Claiming ${allPending.length} pending payment(s)`);

    const results = [];

    // Execute each payment
    for (const payment of allPending) {
      try {
        // Get funder's wallet
        const funderWallet = await getUserWallet(payment.funderId);
        if (!funderWallet?.tempoAddress) {
          throw new Error('Funder wallet not found');
        }

        // Get dedicated Access Key
        const dedicatedKey = await db.query.accessKeys.findFirst({
          where: eq(accessKeys.id, payment.dedicatedAccessKeyId),
        });

        if (!dedicatedKey || dedicatedKey.status !== 'active') {
          throw new Error('Payment authorization revoked');
        }

        // Get bounty metadata for on-chain memo (if this is a bounty payment)
        let issueNumber = 0;
        let prNumber = 0;
        if (payment.bountyId && payment.submissionId) {
          const { getBountyById } = await import('@/db/queries/bounties');
          const bounty = await getBountyById(payment.bountyId);
          if (bounty) {
            issueNumber = bounty.githubIssueNumber;
          }

          const { getSubmissionById } = await import('@/db/queries/submissions');
          const submission = await getSubmissionById(payment.submissionId);
          if (submission?.githubPrNumber) {
            prNumber = submission.githubPrNumber;
          }
        }

        // Build transaction
        const txParams = buildPayoutTransaction({
          tokenAddress: payment.tokenAddress as `0x${string}`,
          recipientAddress: userWallet.tempoAddress as `0x${string}`,
          amount: payment.amount,
          issueNumber,
          prNumber,
          username: payment.recipientGithubUsername,
        });

        // Get nonce
        const nonce = BigInt(
          await tempoClient.getTransactionCount({
            address: funderWallet.tempoAddress as `0x${string}`,
            blockTag: 'pending',
          })
        );

        // Sign with dedicated Access Key
        const { rawTransaction } = await signTransactionWithAccessKey({
          tx: {
            to: txParams.to,
            data: txParams.data,
            value: txParams.value,
            nonce,
          },
          funderAddress: funderWallet.tempoAddress as `0x${string}`,
          network: getNetworkForInsert() as 'testnet' | 'mainnet',
        });

        // Broadcast
        const txHash = await broadcastTransaction(rawTransaction);

        // Create payout record
        const payout = await createPayout({
          submissionId: payment.submissionId ?? undefined,
          bountyId: payment.bountyId ?? undefined,
          recipientUserId: session.user.id,
          payerUserId: payment.funderId,
          recipientPasskeyId: userWallet.id,
          recipientAddress: userWallet.tempoAddress,
          amount: payment.amount,
          tokenAddress: payment.tokenAddress,
        });

        await updatePayoutStatus(payout.id, 'pending', { txHash });

        // Mark pending payment as claimed
        const { markPendingPaymentClaimed } = await import('@/db/queries/pending-payments');
        await markPendingPaymentClaimed({
          paymentId: payment.id,
          userId: session.user.id,
          payoutId: payout.id,
        });

        // Revoke dedicated Access Key (single-use)
        const { revokeDedicatedAccessKey } = await import('@/lib/tempo/dedicated-access-keys');
        await revokeDedicatedAccessKey(payment.dedicatedAccessKeyId);

        results.push({
          success: true,
          txHash,
          amount: payment.amount.toString(),
          tokenAddress: payment.tokenAddress,
        });
      } catch (error) {
        console.error('[claim] Payment failed:', error);
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          amount: payment.amount.toString(),
          tokenAddress: payment.tokenAddress,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    if (successCount === 0) {
      return NextResponse.json({ error: 'All payments failed', details: results }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully claimed ${successCount} payment(s)!`,
      results,
      recipient: {
        address: userWallet.tempoAddress,
        userId: session.user.id,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[claim] Error:', error);
    return NextResponse.json({ error: 'Failed to claim payment' }, { status: 500 });
  }
}
