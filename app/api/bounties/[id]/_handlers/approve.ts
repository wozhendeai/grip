import { db } from '@/db';
import { getNetworkForInsert } from '@/db/network';
import { isOrgMember, getOrgAccessKey, getOrgWalletAddress } from '@/db/queries/organizations';
import { getBountyWithRepoSettings } from '@/db/queries/bounties';
import { getUserWallet } from '@/db/queries/passkeys';
import { createPayout, updatePayoutStatus } from '@/db/queries/payouts';
import {
  approveBountySubmissionAsFunder,
  getActiveSubmissionsForBounty,
  getSubmissionById,
  getSubmissionWithDetails,
} from '@/db/queries/submissions';
import { accessKeys, activityLog } from '@/db/schema/business';
import type { requireAuth } from '@/lib/auth/auth-server';
import { notifyPrApproved } from '@/lib/notifications';
import { tempoClient } from '@/lib/tempo/client';
import { buildPayoutTransaction, encodeBountyMemo } from '@/lib/tempo/payments';
import { broadcastTransaction, signTransactionWithAccessKey } from '@/lib/tempo/keychain-signing';
import { checkOrgMatch } from '@/app/api/_lib';
import { and, eq } from 'drizzle-orm';

type ApproveParams = {
  submissionId?: string;
  useAccessKey?: boolean;
};

/**
 * Handle bounty approval
 *
 * Simplified flow (no pending payments):
 * 1. Validate permissions and submission
 * 2. Require contributor to have wallet (must be signed up)
 * 3. Try auto-sign with Access Key
 * 4. Fall back to manual signing if no Access Key
 */
export async function handleApprove(
  session: Awaited<ReturnType<typeof requireAuth>>,
  bountyId: string,
  params: ApproveParams
) {
  const { useAccessKey = true } = params;

  const result = await getBountyWithRepoSettings(bountyId);
  if (!result) {
    return Response.json({ error: 'Bounty not found' }, { status: 404 });
  }

  const { bounty } = result;
  const isOrgPayment = !!bounty.organizationId;
  const activeOrgId = session.session?.activeOrganizationId;

  // Validate org context
  const orgMismatch = checkOrgMatch(bounty.organizationId, activeOrgId);
  if (orgMismatch) {
    return Response.json({ error: orgMismatch }, { status: 403 });
  }

  // Permission check
  if (isOrgPayment) {
    if (!(await isOrgMember(bounty.organizationId!, session.user.id))) {
      return Response.json(
        { error: 'Only organization members can approve org bounties' },
        { status: 403 }
      );
    }
  } else if (bounty.primaryFunderId !== session.user.id) {
    return Response.json(
      { error: 'Only the primary funder can approve submissions' },
      { status: 403 }
    );
  }

  // Resolve which submission to approve
  const submissionToApprove = await resolveSubmission(bountyId, params.submissionId);
  if ('error' in submissionToApprove) {
    return Response.json(submissionToApprove, { status: 400 });
  }

  // Get contributor wallet - REQUIRED (no pending payments)
  const contributorWallet = await getUserWallet(submissionToApprove.userId);
  if (!contributorWallet?.tempoAddress) {
    return Response.json(
      { error: 'Contributor must create a wallet before receiving payment' },
      { status: 400 }
    );
  }

  // Get funder wallet for personal bounties
  const funderWallet = isOrgPayment ? null : await getUserWallet(session.user.id);

  // Get submission details for memo
  const submissionDetails = await getSubmissionWithDetails(submissionToApprove.id);
  if (!submissionDetails) {
    return Response.json({ error: 'Failed to get submission details' }, { status: 500 });
  }

  // Mark submission as approved
  await approveBountySubmissionAsFunder(submissionToApprove.id, session.user.id, false);

  // Notify contributor
  notifyPrApproved({
    claimantId: submissionToApprove.userId,
    bountyId: bounty.id,
    bountyTitle: bounty.title,
    amount: bounty.totalFunded.toString(),
    tokenAddress: bounty.tokenAddress,
    repoFullName: bounty.githubFullName ?? 'unknown/unknown',
    repoOwner: bounty.githubOwner ?? 'unknown',
    repoName: bounty.githubRepo ?? 'unknown',
  }).catch((err) => console.error('[approve] Notification failed:', err));

  // Create payout record
  const payout = await createPayout({
    submissionId: submissionToApprove.id,
    bountyId: bounty.id,
    recipientUserId: submissionToApprove.userId,
    payerUserId: isOrgPayment ? undefined : (bounty.primaryFunderId ?? undefined),
    payerOrganizationId: isOrgPayment ? (bounty.organizationId ?? undefined) : undefined,
    recipientPasskeyId: contributorWallet.id,
    recipientAddress: contributorWallet.tempoAddress,
    amount: bounty.totalFunded,
    tokenAddress: bounty.tokenAddress,
    memoIssueNumber: bounty.githubIssueNumber,
    memoPrNumber: submissionToApprove.githubPrNumber ?? undefined,
    memoContributor: submissionDetails.submitter.name ?? undefined,
  });

  // Build transaction
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

  // Try auto-signing with Access Key
  if (useAccessKey) {
    const autoSignResult = await tryAutoSign({
      session,
      bounty,
      funderWalletAddress: funderWallet?.tempoAddress,
      payout,
      txParams,
      memo,
      submissionDetails,
      contributorWallet,
      isOrgPayment,
    });
    if (autoSignResult) return autoSignResult;
  }

  // Manual signing fallback
  return Response.json({
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

async function resolveSubmission(bountyId: string, explicitId?: string) {
  if (explicitId) {
    const submission = await getSubmissionById(explicitId);
    if (!submission || submission.bountyId !== bountyId) {
      return { error: 'Invalid submission ID' };
    }
    return submission;
  }

  const activeSubmissions = await getActiveSubmissionsForBounty(bountyId);
  if (activeSubmissions.length === 0) {
    return { error: 'No active submissions to approve' };
  }
  if (activeSubmissions.length > 1) {
    return {
      error: 'Multiple active submissions. Specify submissionId in request body.',
      activeSubmissions: activeSubmissions.map((s) => ({
        id: s.submission.id,
        userId: s.submission.userId,
        submittedAt: s.submission.submittedAt,
      })),
    };
  }
  return activeSubmissions[0].submission;
}

type AutoSignParams = {
  session: Awaited<ReturnType<typeof requireAuth>>;
  bounty: NonNullable<Awaited<ReturnType<typeof getBountyWithRepoSettings>>>['bounty'];
  funderWalletAddress?: string | null;
  payout: Awaited<ReturnType<typeof createPayout>>;
  txParams: ReturnType<typeof buildPayoutTransaction>;
  memo: `0x${string}`;
  submissionDetails: NonNullable<Awaited<ReturnType<typeof getSubmissionWithDetails>>>;
  contributorWallet: NonNullable<Awaited<ReturnType<typeof getUserWallet>>>;
  isOrgPayment: boolean;
};

async function tryAutoSign(params: AutoSignParams): Promise<Response | null> {
  const {
    session,
    bounty,
    funderWalletAddress: personalWallet,
    payout,
    txParams,
    memo,
    submissionDetails,
    contributorWallet,
    isOrgPayment,
  } = params;
  const network = getNetworkForInsert();

  // Get active Access Key
  let activeKey: typeof accessKeys.$inferSelect | null | undefined;
  if (isOrgPayment) {
    activeKey = await getOrgAccessKey(bounty.organizationId!, session.user.id);
  } else {
    activeKey = await db.query.accessKeys.findFirst({
      where: and(
        eq(accessKeys.userId, session.user.id),
        eq(accessKeys.network, network),
        eq(accessKeys.status, 'active')
      ),
    });
  }

  if (!activeKey) return null;

  try {
    const funderWalletAddress = isOrgPayment
      ? await getOrgWalletAddress(bounty.organizationId!)
      : (personalWallet as `0x${string}`);

    if (!funderWalletAddress) throw new Error('Funder wallet not found');

    const nonce = BigInt(
      await tempoClient.getTransactionCount({ address: funderWalletAddress, blockTag: 'pending' })
    );

    const { rawTransaction } = await signTransactionWithAccessKey({
      tx: { to: txParams.to, data: txParams.data, value: txParams.value, nonce },
      funderAddress: funderWalletAddress,
      network: network as 'testnet' | 'mainnet',
    });

    const txHash = await broadcastTransaction(rawTransaction);
    await updatePayoutStatus(payout.id, 'pending', { txHash });

    // Log usage
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

    await db
      .update(accessKeys)
      .set({ lastUsedAt: new Date().toISOString() })
      .where(eq(accessKeys.id, activeKey.id));

    return Response.json({
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
    return null;
  }
}
