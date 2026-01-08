import { getPendingPayoutsByRepoSettings } from '@/db/queries/payouts';
import { getRepoSettingsByGithubRepoId, isUserRepoOwner } from '@/db/queries/repo-settings';
import { requireAuth } from '@/lib/auth/auth-server';
import { buildTransferWithMemoData, encodeBountyMemo } from '@/lib/tempo/payments';
import { handleRouteError } from '@/app/api/_lib';
import type { NextRequest } from 'next/server';

/**
 * GET /api/repo-settings/[id]/payouts/batch
 *
 * Fetch pending payouts for a repository ready for batch signing.
 * Returns transaction operations pre-built for multicall signing.
 */
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<'/api/repo-settings/[id]/payouts/batch'>
) {
  try {
    const session = await requireAuth();
    const { id } = await ctx.params;
    const githubRepoId = Number.parseInt(id);

    if (Number.isNaN(githubRepoId)) {
      return Response.json({ error: 'Invalid repo ID' }, { status: 400 });
    }

    // Verify permissions
    const repoSettings = await getRepoSettingsByGithubRepoId(BigInt(githubRepoId));
    if (!repoSettings) {
      return Response.json({ error: 'Repo settings not found' }, { status: 404 });
    }

    const isOwner = await isUserRepoOwner(BigInt(githubRepoId), session.user.id);
    if (!isOwner) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const pendingPayouts = await getPendingPayoutsByRepoSettings(githubRepoId);

    // Build transaction operations and response
    const { operations, payouts, totalAmount } = buildBatchResponse(pendingPayouts);

    return Response.json({
      count: pendingPayouts.length,
      totalAmount: totalAmount.toString(),
      tokenAddress: pendingPayouts[0]?.payout.tokenAddress,
      operations,
      payouts,
    });
  } catch (error) {
    return handleRouteError(error, 'fetching batch payouts');
  }
}

type PayoutWithDetails = {
  payout: {
    id: string;
    amount: bigint;
    tokenAddress: string;
    recipientAddress: string | null;
    memoIssueNumber: number | null;
    memoPrNumber: number | null;
    memoContributor: string | null;
  };
  bounty: { id: string; title: string; githubIssueNumber: number };
  recipient: { id: string; name: string | null; image: string | null };
};

function buildBatchResponse(pendingPayouts: PayoutWithDetails[]) {
  const operations = pendingPayouts.map((item) => ({
    payoutId: item.payout.id,
    to: item.payout.tokenAddress,
    data: buildTransferWithMemoData({
      to: item.payout.recipientAddress as `0x${string}`,
      amount: item.payout.amount,
      memo: encodeBountyMemo({
        issueNumber: item.payout.memoIssueNumber!,
        prNumber: item.payout.memoPrNumber ?? 0,
        username: item.payout.memoContributor ?? 'anon',
      }),
    }),
    value: '0',
  }));

  const payouts = pendingPayouts.map((item) => ({
    id: item.payout.id,
    amount: item.payout.amount.toString(),
    recipient: {
      id: item.recipient.id,
      name: item.recipient.name,
      address: item.payout.recipientAddress,
    },
    bounty: {
      id: item.bounty.id,
      title: item.bounty.title,
      issueNumber: item.bounty.githubIssueNumber,
    },
  }));

  const totalAmount = pendingPayouts.reduce((sum, item) => sum + item.payout.amount, BigInt(0));

  return { operations, payouts, totalAmount };
}
