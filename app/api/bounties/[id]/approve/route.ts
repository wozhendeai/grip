import { db } from '@/db';
import { getNetworkForInsert } from '@/db/network';
import { getBountyWithRepoSettings } from '@/db/queries/bounties';
import { getUserWallet } from '@/db/queries/passkeys';
import { createPayout, updatePayoutStatus } from '@/db/queries/payouts';
import {
  approveBountySubmissionAsFunder,
  getActiveSubmissionsForBounty,
  getSubmissionById,
  getSubmissionWithDetails,
  getUserSubmissionForBounty,
} from '@/db/queries/submissions';
import { accessKeys, activityLog } from '@/db/schema/business';
import { requireAuth } from '@/lib/auth/auth-server';
import { notifyPrApproved } from '@/lib/notifications';
import { buildPayoutTransaction, encodeBountyMemo } from '@/lib/tempo';
import { tempoClient } from '@/lib/tempo/client';
import { TEMPO_CHAIN_ID } from '@/lib/tempo/constants';
import { broadcastTransaction, signTransactionWithAccessKey } from '@/lib/tempo/keychain-signing';
import { and, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/bounties/[id]/approve
 *
 * Approve a bounty submission and prepare the payout.
 * In the promise model, the primary funder controls approvals.
 * Supports multiple concurrent submissions - auto-detects which submission to approve or requires explicit submissionId.
 *
 * Access Key Auto-Signing:
 * If funder has an active Access Key, the backend will automatically sign and broadcast the payout transaction.
 * Otherwise, returns txParams for manual passkey signing (legacy flow).
 *
 * Body (optional):
 * - submissionId: Specific submission to approve (required if multiple active submissions)
 * - note: Approval note
 * - useAccessKey: boolean (default: true) - If true, attempt auto-signing with Access Key
 *
 * Returns:
 * - payout: Payout record
 * - txHash?: Transaction hash (if auto-signed)
 * - txParams?: Transaction params for manual signing (if Access Key not available)
 * - autoSigned: boolean - Whether payment was sent automatically
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;

    // Parse request body
    let body: { submissionId?: string; note?: string; useAccessKey?: boolean } = {};
    try {
      body = await request.json();
    } catch {
      // Body is optional
    }

    // Default to using Access Key if not specified
    const useAccessKey = body.useAccessKey !== false;

    // Get bounty with repo settings
    const result = await getBountyWithRepoSettings(id);
    if (!result) {
      return NextResponse.json({ error: 'Bounty not found' }, { status: 404 });
    }

    const { bounty } = result;

    // Permission check: primary funder controls approvals
    if (bounty.primaryFunderId !== session.user.id) {
      return NextResponse.json(
        { error: 'Only the primary funder can approve submissions' },
        { status: 403 }
      );
    }

    // Submission resolution logic: Determine which submission to approve
    let submissionToApprove = null;

    if (body.submissionId) {
      // Explicit submission ID provided
      submissionToApprove = await getSubmissionById(body.submissionId);
      if (!submissionToApprove || submissionToApprove.bountyId !== id) {
        return NextResponse.json({ error: 'Invalid submission ID' }, { status: 400 });
      }
    } else {
      // Auto-detect: count active submissions
      const activeSubmissions = await getActiveSubmissionsForBounty(id);
      if (activeSubmissions.length === 0) {
        return NextResponse.json({ error: 'No active submissions to approve' }, { status: 400 });
      }
      if (activeSubmissions.length === 1) {
        submissionToApprove = activeSubmissions[0].submission;
      } else {
        return NextResponse.json(
          {
            error: 'Multiple active submissions. Specify submissionId in request body.',
            activeSubmissions: activeSubmissions.map((s) => ({
              id: s.submission.id,
              userId: s.submission.userId,
              submittedAt: s.submission.submittedAt,
            })),
          },
          { status: 400 }
        );
      }
    }

    if (!submissionToApprove) {
      return NextResponse.json({ error: 'No submission to approve' }, { status: 400 });
    }

    // Get contributor's wallet
    const contributorWallet = await getUserWallet(submissionToApprove.userId);

    // Branch 1: Contributor has wallet → Normal flow
    if (contributorWallet?.tempoAddress) {
      // Get submission details for PR info
      const submissionDetails = await getSubmissionWithDetails(submissionToApprove.id);
      if (!submissionDetails) {
        return NextResponse.json({ error: 'Failed to get submission details' }, { status: 500 });
      }

      // Approve the submission (requireOwnerApproval=false since funder controls approvals in promise model)
      await approveBountySubmissionAsFunder(submissionToApprove.id, session.user.id, false);

      // Notify contributor that PR was approved
      // Wrapped in try-catch to not block approval flow if notification fails
      try {
        await notifyPrApproved({
          claimantId: submissionToApprove.userId,
          bountyId: bounty.id,
          bountyTitle: bounty.title,
          amount: bounty.totalFunded.toString(),
          tokenAddress: bounty.tokenAddress,
          repoFullName: bounty.githubFullName ?? 'unknown/unknown',
          repoOwner: bounty.githubOwner ?? 'unknown',
          repoName: bounty.githubRepo ?? 'unknown',
        });
      } catch (error) {
        console.error('[approve] Failed to create PR approved notification:', error);
      }

      // Create payout record
      const payout = await createPayout({
        submissionId: submissionToApprove.id,
        bountyId: bounty.id,
        recipientUserId: submissionToApprove.userId,
        payerUserId: bounty.primaryFunderId,
        recipientPasskeyId: contributorWallet.id,
        recipientAddress: contributorWallet.tempoAddress,
        amount: bounty.totalFunded,
        tokenAddress: bounty.tokenAddress,
        memoIssueNumber: bounty.githubIssueNumber,
        memoPrNumber: submissionToApprove.githubPrNumber ?? undefined,
        memoContributor: submissionDetails.submitter.name ?? undefined,
      });

      // Build transaction params
      const txParams = buildPayoutTransaction({
        tokenAddress: bounty.tokenAddress as `0x${string}`,
        recipientAddress: contributorWallet.tempoAddress as `0x${string}`,
        amount: BigInt(bounty.totalFunded.toString()),
        issueNumber: bounty.githubIssueNumber,
        prNumber: submissionToApprove.githubPrNumber ?? 0,
        username: submissionDetails.submitter.name ?? 'anon',
      });

      const memo = encodeBountyMemo({
        issueNumber: bounty.githubIssueNumber,
        prNumber: submissionToApprove.githubPrNumber ?? 0,
        username: submissionDetails.submitter.name ?? 'anon',
      });

      // Check for active Access Key and attempt auto-signing
      if (useAccessKey) {
        const network = getNetworkForInsert();

        // Query for active Access Key
        const activeKey = await db.query.accessKeys.findFirst({
          where: and(
            eq(accessKeys.userId, session.user.id),
            eq(accessKeys.network, network),
            eq(accessKeys.status, 'active')
          ),
        });

        if (activeKey) {
          try {
            console.log('[approve] Found active Access Key, attempting auto-sign...');

            // Get funder's wallet address
            const funderWallet = await getUserWallet(session.user.id);
            if (!funderWallet?.tempoAddress) {
              throw new Error('Funder wallet not found');
            }

            // Get nonce for funder's account
            const nonce = BigInt(
              await tempoClient.getTransactionCount({
                address: funderWallet.tempoAddress as `0x${string}`,
                blockTag: 'pending',
              })
            );

            // Sign transaction with Access Key (Keychain signature via Turnkey)
            const { rawTransaction, hash } = await signTransactionWithAccessKey({
              tx: {
                to: txParams.to,
                data: txParams.data,
                value: txParams.value,
                nonce,
              },
              funderAddress: funderWallet.tempoAddress as `0x${string}`,
              network: network as 'testnet' | 'mainnet',
            });

            // Broadcast transaction to Tempo
            const txHash = await broadcastTransaction(rawTransaction);

            console.log('[approve] Transaction broadcast successful:', txHash);

            // Update payout with transaction hash
            await updatePayoutStatus(payout.id, 'pending', { txHash });

            // Log Access Key usage in activity log
            await db.insert(activityLog).values({
              eventType: 'access_key_created',
              network,
              userId: session.user.id,
              bountyId: bounty.id,
              payoutId: payout.id,
              metadata: {
                accessKeyId: activeKey.id,
                backendWalletAddress: activeKey.backendWalletAddress,
                tokenAddress: bounty.tokenAddress,
                amount: bounty.totalFunded.toString(),
                txHash,
              },
            });

            // Update last used timestamp
            await db
              .update(accessKeys)
              .set({ lastUsedAt: new Date().toISOString() })
              .where(eq(accessKeys.id, activeKey.id));

            // Return success with auto-signed transaction
            return NextResponse.json({
              message: 'Payment sent automatically via Access Key',
              autoSigned: true,
              payout: {
                id: payout.id,
                bountyId: payout.bountyId,
                amount: payout.amount,
                tokenAddress: payout.tokenAddress,
                recipientAddress: payout.recipientAddress,
                memo,
                status: 'pending',
                txHash,
              },
              contributor: {
                id: submissionDetails.submitter.id,
                name: submissionDetails.submitter.name,
                address: contributorWallet.tempoAddress,
              },
            });
          } catch (error) {
            console.error('[approve] Access Key auto-signing failed:', error);
            // Fall through to manual signing flow
            // Don't throw - just log error and return txParams for manual signing
          }
        } else {
          console.log('[approve] No active Access Key found, falling back to manual signing');
        }
      }

      // Manual signing flow (legacy or fallback)
      return NextResponse.json({
        message: 'Submission approved. Ready for payment.',
        autoSigned: false,
        payout: {
          id: payout.id,
          bountyId: payout.bountyId,
          amount: payout.amount,
          tokenAddress: payout.tokenAddress,
          recipientAddress: payout.recipientAddress,
          memo,
          status: payout.status,
        },
        txParams: {
          to: txParams.to,
          data: txParams.data,
          value: txParams.value.toString(),
        },
        contributor: {
          id: submissionDetails.submitter.id,
          name: submissionDetails.submitter.name,
          address: contributorWallet.tempoAddress,
        },
      });
    }

    // Branch 2: Contributor has NO wallet → Pending Payment flow

    console.log('[approve] Contributor has no wallet - creating pending payment');

    // Get GitHub user info
    const submissionDetails = await getSubmissionWithDetails(submissionToApprove.id);
    if (!submissionDetails) {
      return NextResponse.json({ error: 'Failed to get submission details' }, { status: 500 });
    }

    const githubUsername = submissionDetails.submitter.name ?? 'unknown';
    const githubUserId = submissionDetails.submitter.githubUserId;

    if (!githubUserId) {
      return NextResponse.json(
        { error: 'Cannot create pending payment: GitHub user ID not found' },
        { status: 400 }
      );
    }

    // Parse Access Key signature from request body
    const { accessKeySignature, accessKeyAuthHash } = body as {
      accessKeySignature?: string;
      accessKeyAuthHash?: string;
    };

    if (!accessKeySignature || !accessKeyAuthHash) {
      // Return response indicating frontend needs to collect signature
      return NextResponse.json(
        {
          requiresAccessKeySignature: true,
          payment: {
            amount: bounty.totalFunded.toString(),
            tokenAddress: bounty.tokenAddress,
            recipientGithubUsername: githubUsername,
            recipientGithubUserId: githubUserId.toString(),
          },
        },
        { status: 400 }
      );
    }

    try {
      // Check balance before creating pending payment
      // Prevents bad UX: contributor claim fails on-chain if funder has insufficient balance
      const funderWallet = await getUserWallet(session.user.id);
      if (!funderWallet?.tempoAddress) {
        return NextResponse.json({ error: 'Funder wallet not found' }, { status: 400 });
      }

      const { checkSufficientBalance } = await import('@/lib/tempo/balance');
      const balanceCheck = await checkSufficientBalance({
        funderId: session.user.id,
        walletAddress: funderWallet.tempoAddress,
        tokenAddress: bounty.tokenAddress,
        newAmount: bounty.totalFunded,
      });

      if (!balanceCheck.sufficient) {
        // Format amounts for error message (assuming 6 decimals for USDC)
        const balanceFormatted = (Number(balanceCheck.balance) / 1_000_000).toFixed(2);
        const requiredFormatted = (Number(balanceCheck.totalLiabilities) / 1_000_000).toFixed(2);
        const shortfallFormatted = (
          Number(balanceCheck.totalLiabilities - balanceCheck.balance) / 1_000_000
        ).toFixed(2);

        return NextResponse.json(
          {
            error: 'Insufficient balance for pending payment',
            details: {
              message: `You have $${balanceFormatted} USDC but need $${requiredFormatted} USDC (including existing pending payments). Please fund your wallet with at least $${shortfallFormatted} USDC more.`,
              balance: balanceCheck.balance.toString(),
              required: balanceCheck.totalLiabilities.toString(),
              shortfall: (balanceCheck.totalLiabilities - balanceCheck.balance).toString(),
            },
          },
          { status: 400 }
        );
      }

      // Create dedicated Access Key
      const { createDedicatedAccessKey } = await import('@/lib/tempo/dedicated-access-keys');
      const dedicatedKey = await createDedicatedAccessKey({
        userId: session.user.id,
        tokenAddress: bounty.tokenAddress,
        amount: bounty.totalFunded,
        authorizationSignature: accessKeySignature,
        authorizationHash: accessKeyAuthHash,
        chainId: TEMPO_CHAIN_ID,
      });

      console.log(`[approve] Created dedicated Access Key: ${dedicatedKey.id}`);

      // Create pending payment
      const { createPendingPayment } = await import('@/db/queries/pending-payments');
      const pendingPayment = await createPendingPayment({
        bountyId: bounty.id,
        submissionId: submissionToApprove.id,
        funderId: session.user.id,
        recipientGithubUserId: Number(githubUserId),
        recipientGithubUsername: githubUsername,
        amount: bounty.totalFunded,
        tokenAddress: bounty.tokenAddress,
        dedicatedAccessKeyId: dedicatedKey.id,
      });

      console.log(`[approve] Created pending payment: ${pendingPayment.id}`);

      // Approve submission
      await approveBountySubmissionAsFunder(submissionToApprove.id, session.user.id, false);

      // Send pending payment notification (if contributor has account)
      // Design Decision: Only notify if contributor already has BountyLane account (but no wallet)
      // - New users won't see notification anyway (not logged in)
      // - Funder gets claim URL in response for manual sharing
      try {
        const { getUserByName } = await import('@/db/queries/users');
        const recipientUser = await getUserByName(githubUsername);

        if (recipientUser) {
          // Recipient has account but no wallet - notify them
          const { notifyPendingPaymentCreated } = await import('@/lib/notifications');
          await notifyPendingPaymentCreated({
            recipientId: recipientUser.id,
            funderName: session.user.name ?? 'Someone',
            amount: bounty.totalFunded.toString(),
            tokenAddress: bounty.tokenAddress,
            claimUrl: `${process.env.NEXT_PUBLIC_APP_URL}/claim/${pendingPayment.claimToken}`,
            claimExpiresAt: pendingPayment.claimExpiresAt,
            bountyId: bounty.id,
            bountyTitle: bounty.title,
          });
        }
      } catch (error) {
        console.error('[approve] Failed to send pending payment notification:', error);
      }

      return NextResponse.json({
        success: true,
        message: 'Payment authorized. Share the claim link with the contributor.',
        pendingPayment: {
          id: pendingPayment.id,
          amount: pendingPayment.amount.toString(),
          tokenAddress: pendingPayment.tokenAddress,
          claimUrl: `${process.env.NEXT_PUBLIC_APP_URL}/claim/${pendingPayment.claimToken}`,
          claimExpiresAt: pendingPayment.claimExpiresAt,
        },
        contributor: {
          githubUserId: githubUserId.toString(),
          githubUsername,
        },
      });
    } catch (error) {
      console.error('[approve] Failed to create pending payment:', error);
      return NextResponse.json({ error: 'Failed to create pending payment' }, { status: 500 });
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error approving bounty:', error);
    return NextResponse.json({ error: 'Failed to approve bounty' }, { status: 500 });
  }
}
