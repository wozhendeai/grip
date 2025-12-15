import { requireAuth } from '@/lib/auth-server';
import { getPayoutsByRepoSettings } from '@/lib/db/queries/payouts';
import { getRepoSettingsByGithubRepoId, isUserRepoOwner } from '@/lib/db/queries/repo-settings';
import { buildTransferWithMemoData, encodeBountyMemo } from '@/lib/tempo/payments';
import { type NextRequest, NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;
    const githubRepoId = Number.parseInt(id);

    if (Number.isNaN(githubRepoId)) {
      return NextResponse.json({ error: 'Invalid repo ID' }, { status: 400 });
    }

    // Verify permissions
    const repoSettings = await getRepoSettingsByGithubRepoId(BigInt(githubRepoId));
    if (!repoSettings) {
      return NextResponse.json({ error: 'Repo settings not found' }, { status: 404 });
    }

    // Check if user is repo owner
    const isOwner = await isUserRepoOwner(BigInt(githubRepoId), session.user.id);
    if (!isOwner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get approved payouts for this repo
    const approvedPayouts = await getPayoutsByRepoSettings(githubRepoId);

    // Define type for payout data structure
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

    // Build transaction operations for each payout
    const operations = approvedPayouts.map((item: PayoutWithDetails) => ({
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

    const totalAmount = approvedPayouts.reduce(
      (sum: bigint, item: PayoutWithDetails) => sum + item.payout.amount,
      BigInt(0)
    );

    return NextResponse.json({
      count: approvedPayouts.length,
      totalAmount: totalAmount.toString(),
      tokenAddress: approvedPayouts[0]?.payout.tokenAddress,
      operations,
      payouts: approvedPayouts.map((item: PayoutWithDetails) => ({
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
      })),
    });
  } catch (error) {
    console.error('Error fetching batch payouts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
