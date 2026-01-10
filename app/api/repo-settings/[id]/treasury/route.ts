import { getCommittedBalanceByRepoId } from '@/db/queries/bounties';
import { getRepoSettingsByGithubRepoId, isUserRepoOwner } from '@/db/queries/repo-settings';
import { auth } from '@/lib/auth/auth';
import { requireAuth } from '@/lib/auth/auth-server';
import { tempoClient } from '@/lib/tempo/client';
import { getTokenMetadata } from '@/lib/tempo/tokens';
import { headers } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { formatUnits } from 'viem';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/repo-settings/[id]/treasury
 *
 * Get treasury address and committed balance for a repo (owner's passkey).
 * Requires authentication and repo ownership.
 *
 * Returns:
 * - address: Repo owner's tempo address
 * - committed: DB-backed liabilities summary
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;
    const githubRepoId = Number.parseInt(id);

    if (Number.isNaN(githubRepoId)) {
      return NextResponse.json({ error: 'Invalid repo ID' }, { status: 400 });
    }

    // Get repo settings
    const repoSettings = await getRepoSettingsByGithubRepoId(BigInt(githubRepoId));
    if (!repoSettings) {
      return NextResponse.json({ error: 'Repo settings not found' }, { status: 404 });
    }

    // Check user is repo owner
    const isOwner = await isUserRepoOwner(BigInt(githubRepoId), session.user.id);
    if (!isOwner) {
      return NextResponse.json(
        { error: 'You do not have access to this repo treasury' },
        { status: 403 }
      );
    }

    // Get owner's passkey wallet via tempo plugin API
    const headersList = await headers();
    const { wallets } = await auth.api.listWallets({ headers: headersList });
    const ownerWallet = wallets.find((w) => w.walletType === 'passkey');

    if (!ownerWallet?.address) {
      return NextResponse.json({
        configured: false,
        message: 'No wallet found. Create a passkey to manage repo treasury.',
      });
    }

    // Get owner's fee token preference
    const userFeeToken = await tempoClient.fee.getUserToken({
      account: ownerWallet.address as `0x${string}`,
    });
    const tokenAddress = userFeeToken?.address as `0x${string}` | undefined;

    // Get committed balance and token metadata (if token is set)
    const committedBalance = await getCommittedBalanceByRepoId(BigInt(githubRepoId));

    if (tokenAddress) {
      const metadata = await getTokenMetadata(tokenAddress);
      return NextResponse.json({
        configured: true,
        address: ownerWallet.address,
        walletId: ownerWallet.id,
        committed: {
          raw: committedBalance.toString(),
          formatted: formatUnits(committedBalance, metadata.decimals),
        },
        tokenAddress,
        tokenDecimals: metadata.decimals,
        tokenSymbol: metadata.symbol,
      });
    }

    // No fee token set - return without token info
    return NextResponse.json({
      configured: true,
      address: ownerWallet.address,
      walletId: ownerWallet.id,
      committed: {
        raw: committedBalance.toString(),
        formatted: formatUnits(committedBalance, 6), // Default decimals for display
      },
      tokenAddress: undefined,
      tokenDecimals: undefined,
      tokenSymbol: undefined,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error getting treasury:', error);
    return NextResponse.json({ error: 'Failed to get treasury info' }, { status: 500 });
  }
}

/**
 * POST /api/repo-settings/[id]/treasury
 *
 * In the new model, repo treasury = repo owner's wallet.
 * This endpoint is deprecated but kept for compatibility.
 * Just verifies the owner has a passkey configured.
 *
 * Returns:
 * - success: boolean
 * - message: Info about treasury configuration
 */
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;
    const githubRepoId = Number.parseInt(id);

    if (Number.isNaN(githubRepoId)) {
      return NextResponse.json({ error: 'Invalid repo ID' }, { status: 400 });
    }

    // Get repo settings
    const repoSettings = await getRepoSettingsByGithubRepoId(BigInt(githubRepoId));
    if (!repoSettings) {
      return NextResponse.json({ error: 'Repo settings not found' }, { status: 404 });
    }

    // Check user is repo owner
    const isOwner = await isUserRepoOwner(BigInt(githubRepoId), session.user.id);
    if (!isOwner) {
      return NextResponse.json(
        { error: 'You do not have permission to manage this repo treasury' },
        { status: 403 }
      );
    }

    // Verify owner has a passkey wallet via tempo plugin API
    const headersList = await headers();
    const { wallets } = await auth.api.listWallets({ headers: headersList });
    const ownerWallet = wallets.find((w) => w.walletType === 'passkey');

    if (!ownerWallet?.address) {
      return NextResponse.json(
        { error: 'No wallet configured. Create a passkey first.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Repo treasury uses your wallet (passkey). No separate configuration needed.',
      treasury: {
        configured: true,
        address: ownerWallet.address,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error checking treasury:', error);
    return NextResponse.json({ error: 'Failed to check treasury' }, { status: 500 });
  }
}
