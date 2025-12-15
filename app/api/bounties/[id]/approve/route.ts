import { db } from '@/db';
import { accessKeys, activityLog } from '@/db/schema/business';
import { requireAuth } from '@/lib/auth-server';
import { getNetworkForInsert } from '@/lib/db/network';
import { getBountyWithRepoSettings } from '@/lib/db/queries/bounties';
import { getUserWallet } from '@/lib/db/queries/passkeys';
import { createPayout, updatePayoutStatus } from '@/lib/db/queries/payouts';
import {
  approveBountySubmissionAsFunder,
  getActiveSubmissionsForBounty,
  getSubmissionById,
  getSubmissionWithDetails,
  getUserSubmissionForBounty,
} from '@/lib/db/queries/submissions';
import { notifyPrApproved } from '@/lib/notifications';
import { buildPayoutTransaction, encodeBountyMemo } from '@/lib/tempo';
import { broadcastTransaction, signTransactionWithAccessKey } from '@/lib/tempo/keychain-signing';
import { getNonce } from '@/lib/tempo/signing';
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
            const nonce = await getNonce(funderWallet.tempoAddress as `0x${string}`);

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

    // Branch 2: Contributor has NO wallet → Custodial flow

    // Import custodial wallet functions
    const { getCustodialWalletByGithubUserId, createCustodialWalletRecord } = await import(
      '@/lib/db/queries/custodial-wallets'
    );
    const { createCustodialWallet } = await import('@/lib/turnkey/custodial-wallets');

    // Get GitHub user info from submission
    const submissionDetails = await getSubmissionWithDetails(submissionToApprove.id);
    if (!submissionDetails) {
      return NextResponse.json({ error: 'Failed to get submission details' }, { status: 500 });
    }

    const githubUsername = submissionDetails.submitter.name ?? 'unknown';
    const githubUserId = submissionDetails.submitter.githubUserId;

    if (!githubUserId) {
      return NextResponse.json(
        { error: 'Cannot create custodial wallet: GitHub user ID not found' },
        { status: 400 }
      );
    }

    // Check if custodial wallet already exists for this GitHub user
    let custodialWallet = await getCustodialWalletByGithubUserId(githubUserId);

    if (!custodialWallet) {
      try {
        console.log(`[approve] Creating custodial wallet for GitHub user ${githubUserId}`);

        // Create new Turnkey wallet
        const { walletId, accountId, address } = await createCustodialWallet({
          githubUserId: Number(githubUserId),
          githubUsername,
        });

        // Generate claim token (256-bit random)
        const crypto = await import('node:crypto');
        const claimToken = crypto.randomBytes(32).toString('hex');
        const claimExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

        // Store in database
        custodialWallet = await createCustodialWalletRecord({
          githubUserId,
          githubUsername,
          turnkeyWalletId: walletId,
          turnkeyAccountId: accountId,
          address,
          claimToken,
          claimExpiresAt,
        });

        console.log(`[approve] Custodial wallet created: ${address}`);
      } catch (error) {
        console.error('[approve] Failed to create custodial wallet:', error);
        return NextResponse.json(
          { error: 'Failed to create custodial wallet for contributor' },
          { status: 500 }
        );
      }
    }

    // Approve submission
    await approveBountySubmissionAsFunder(submissionToApprove.id, session.user.id, false);

    // Notify contributor that PR was approved
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

    // Create payout pointing to custodial wallet
    const payout = await createPayout({
      submissionId: submissionToApprove.id,
      bountyId: bounty.id,
      recipientUserId: submissionToApprove.userId,
      payerUserId: bounty.primaryFunderId,
      recipientPasskeyId: null, // No passkey yet
      recipientAddress: custodialWallet.address,
      amount: bounty.totalFunded,
      tokenAddress: bounty.tokenAddress,
      custodialWalletId: custodialWallet.id,
      isCustodial: true,
      memoIssueNumber: bounty.githubIssueNumber,
      memoPrNumber: submissionToApprove.githubPrNumber ?? undefined,
      memoContributor: githubUsername,
    });

    // Build transaction params
    const txParams = buildPayoutTransaction({
      tokenAddress: bounty.tokenAddress as `0x${string}`,
      recipientAddress: custodialWallet.address as `0x${string}`,
      amount: BigInt(bounty.totalFunded.toString()),
      issueNumber: bounty.githubIssueNumber,
      prNumber: submissionToApprove.githubPrNumber ?? 0,
      username: githubUsername,
    });

    const memo = encodeBountyMemo({
      issueNumber: bounty.githubIssueNumber,
      prNumber: submissionToApprove.githubPrNumber ?? 0,
      username: githubUsername,
    });

    // Try Access Key auto-signing (same as normal flow)
    if (useAccessKey) {
      const network = getNetworkForInsert();

      const activeKey = await db.query.accessKeys.findFirst({
        where: and(
          eq(accessKeys.userId, session.user.id),
          eq(accessKeys.network, network),
          eq(accessKeys.status, 'active')
        ),
      });

      if (activeKey) {
        try {
          console.log(
            '[approve] Found active Access Key, attempting auto-sign for custodial payment...'
          );

          const funderWallet = await getUserWallet(session.user.id);
          if (!funderWallet?.tempoAddress) {
            throw new Error('Funder wallet not found');
          }

          const nonce = await getNonce(funderWallet.tempoAddress as `0x${string}`);

          const { rawTransaction } = await signTransactionWithAccessKey({
            tx: {
              to: txParams.to,
              data: txParams.data,
              value: txParams.value,
              nonce,
            },
            funderAddress: funderWallet.tempoAddress as `0x${string}`,
            network: network as 'testnet' | 'mainnet',
          });

          const txHash = await broadcastTransaction(rawTransaction);

          console.log('[approve] Custodial payment broadcast successful:', txHash);

          await updatePayoutStatus(payout.id, 'pending', { txHash });

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
              custodial: true,
            },
          });

          await db
            .update(accessKeys)
            .set({ lastUsedAt: new Date().toISOString() })
            .where(eq(accessKeys.id, activeKey.id));

          return NextResponse.json({
            message: 'Payment sent to custodial wallet. Contributor can claim when they sign up.',
            custodial: true,
            autoSigned: true,
            payout: {
              id: payout.id,
              status: 'pending',
              amount: payout.amount,
              tokenAddress: payout.tokenAddress,
              custodialAddress: custodialWallet.address,
              claimUrl: `/claim/${custodialWallet.claimToken}`,
              memo,
              txHash,
            },
            contributor: {
              id: submissionDetails.submitter.id,
              name: githubUsername,
              githubUserId,
            },
          });
        } catch (error) {
          console.error('[approve] Custodial payment auto-signing failed:', error);
          // Fall through to manual signing
        }
      }
    }

    // Manual signing flow - return txParams
    return NextResponse.json({
      message: 'Ready to send payment to custodial wallet',
      custodial: true,
      autoSigned: false,
      payout: {
        id: payout.id,
        amount: payout.amount,
        tokenAddress: payout.tokenAddress,
        custodialAddress: custodialWallet.address,
        claimUrl: `/claim/${custodialWallet.claimToken}`,
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
        name: githubUsername,
        githubUserId,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error approving bounty:', error);
    return NextResponse.json({ error: 'Failed to approve bounty' }, { status: 500 });
  }
}
