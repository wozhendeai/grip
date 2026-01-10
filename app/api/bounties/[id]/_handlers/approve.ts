import { db } from '@/db';
import { chainIdFilter, getChainId, getNetworkName } from '@/db/network';
import { getOrgAccessKey, getOrgWalletAddress } from '@/db/queries/organizations';
import { getBountyWithRepoSettings } from '@/db/queries/bounties';
import { auth } from '@/lib/auth/auth';
import { headers } from 'next/headers';
import { getUserWallet } from '@/db/queries/passkeys';
import { createPayout, updatePayoutStatus } from '@/db/queries/payouts';
import {
  approveBountySubmissionAsFunder,
  getActiveSubmissionsForBounty,
  getSubmissionById,
  getSubmissionWithDetails,
} from '@/db/queries/submissions';
import { activityLog } from '@/db/schema/business';
import { accessKey } from '@/db/schema/auth';
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
    const headersList = await headers();
    const hasPermission = await auth.api.hasPermission({
      headers: headersList,
      body: { permissions: { member: ['read'] }, organizationId: bounty.organizationId! },
    });
    if (!hasPermission?.success) {
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
  if (!contributorWallet?.address) {
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
    recipientPasskeyId: contributorWallet.passkeyId,
    recipientAddress: contributorWallet.address,
    amount: bounty.totalFunded,
    tokenAddress: bounty.tokenAddress,
    memoIssueNumber: bounty.githubIssueNumber,
    memoPrNumber: submissionToApprove.githubPrNumber ?? undefined,
    memoContributor: submissionDetails.submitter.name ?? undefined,
  });

  // Build transaction
  const txParams = buildPayoutTransaction({
    tokenAddress: bounty.tokenAddress as `0x${string}`,
    recipientAddress: contributorWallet.address as `0x${string}`,
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
      funderWalletAddress: funderWallet?.address,
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
      address: contributorWallet.address,
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
  const network = getNetworkName();

  // Get active Access Key
  let activeKey: typeof accessKey.$inferSelect | null | undefined;
  if (isOrgPayment) {
    activeKey = await getOrgAccessKey(bounty.organizationId!, session.user.id);
  } else {
    activeKey = await db.query.accessKey.findFirst({
      where: and(
        eq(accessKey.userId, session.user.id),
        chainIdFilter(accessKey),
        eq(accessKey.status, 'active')
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

    // Log usage (using access_key_created event for now - should add access_key_used to enum)
    await db.insert(activityLog).values({
      eventType: 'payout_sent',
      chainId: getChainId(),
      userId: session.user.id,
      bountyId: bounty.id,
      payoutId: payout.id,
      metadata: {
        accessKeyId: activeKey.id,
        keyWalletId: activeKey.keyWalletId,
        tokenAddress: bounty.tokenAddress,
        amount: bounty.totalFunded.toString(),
        txHash,
      },
    });

    await db
      .update(accessKey)
      .set({ lastUsedAt: new Date() })
      .where(eq(accessKey.id, activeKey.id));

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
        address: contributorWallet.address,
      },
    });
  } catch (error) {
    console.error('[approve] Access Key auto-signing failed:', error);
    return null;
  }
}
