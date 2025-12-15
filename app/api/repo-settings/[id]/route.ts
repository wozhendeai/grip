import { getBountiesByGithubRepoId } from '@/lib/db/queries/bounties';
import { getRepoSettingsByGithubRepoId } from '@/lib/db/queries/repo-settings';
import { type NextRequest, NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const githubRepoId = Number.parseInt(id);

    if (Number.isNaN(githubRepoId)) {
      return NextResponse.json({ error: 'Invalid repo ID' }, { status: 400 });
    }

    const repoSettings = await getRepoSettingsByGithubRepoId(BigInt(githubRepoId));

    if (!repoSettings) {
      return NextResponse.json({ error: 'Repo settings not found' }, { status: 404 });
    }

    const bounties = await getBountiesByGithubRepoId(BigInt(githubRepoId));

    // Define type for bounty
    type Bounty = {
      id: string;
      status: string;
      totalFunded: bigint;
      title: string;
      tokenAddress: string;
      githubIssueNumber: number;
      createdAt: string | null;
    };

    // Compute stats from bounties (not cached)
    const totalFunded = bounties
      .filter((b: Bounty) => b.status === 'open')
      .reduce((sum: bigint, b: Bounty) => sum + b.totalFunded, BigInt(0));
    const totalPaid = bounties
      .filter((b: Bounty) => b.status === 'completed')
      .reduce((sum: bigint, b: Bounty) => sum + b.totalFunded, BigInt(0));
    const bountiesCreated = bounties.length;
    const bountiesCompleted = bounties.filter((b: Bounty) => b.status === 'completed').length;

    return NextResponse.json({
      repoSettings,
      bounties: bounties.map((bounty: Bounty) => ({
        id: bounty.id,
        title: bounty.title,
        totalFunded: bounty.totalFunded.toString(),
        tokenAddress: bounty.tokenAddress,
        status: bounty.status,
        githubIssueNumber: bounty.githubIssueNumber,
        createdAt: bounty.createdAt,
      })),
      stats: {
        totalFunded: totalFunded.toString(),
        totalPaid: totalPaid.toString(),
        bountiesCreated,
        bountiesCompleted,
      },
    });
  } catch (error) {
    console.error('Error fetching repo settings:', error);
    return NextResponse.json({ error: 'Failed to fetch repo settings' }, { status: 500 });
  }
}
