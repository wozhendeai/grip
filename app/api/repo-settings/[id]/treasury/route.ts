import { db, passkey } from '@/db';
import { requireAuth } from '@/lib/auth-server';
import { getRepoSettingsByGithubRepoId, isUserRepoOwner } from '@/lib/db/queries/repo-settings';
import { getTokenInfo } from '@/lib/tempo/balance';
import { TEMPO_TOKENS } from '@/lib/tempo/constants';
import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/repo-settings/[id]/treasury
 *
 * Get treasury balance and address for a repo (owner's passkey).
 * Requires authentication and repo ownership.
 *
 * Returns:
 * - address: Repo owner's tempo address
 * - balance: TIP-20 balance info
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

    // Get owner's passkeys (treasury = owner's wallet)
    const ownerPasskeys = await db
      .select({
        id: passkey.id,
        name: passkey.name,
        tempoAddress: passkey.tempoAddress,
      })
      .from(passkey)
      .where(eq(passkey.userId, session.user.id));

    if (ownerPasskeys.length === 0 || !ownerPasskeys[0]?.tempoAddress) {
      return NextResponse.json({
        configured: false,
        message: 'No passkey found. Create a passkey to manage repo treasury.',
      });
    }

    // Use first passkey as treasury
    const treasuryPasskey = ownerPasskeys[0];

    // Get token balance
    const tokenAddress = TEMPO_TOKENS.USDC;
    let tokenInfo: Awaited<ReturnType<typeof getTokenInfo>> | undefined;

    try {
      tokenInfo = await getTokenInfo(treasuryPasskey.tempoAddress as `0x${string}`, tokenAddress);
    } catch (error) {
      console.error('Error fetching treasury balance:', error);
      // Return structure even if balance fetch fails
      return NextResponse.json({
        configured: true,
        address: treasuryPasskey.tempoAddress,
        balance: null,
        error: 'Failed to fetch balance from Tempo RPC',
      });
    }

    return NextResponse.json({
      configured: true,
      address: treasuryPasskey.tempoAddress,
      balance: {
        raw: tokenInfo.balance.toString(),
        formatted: tokenInfo.formattedBalance,
        decimals: tokenInfo.decimals,
        symbol: tokenInfo.symbol,
      },
      tokenAddress,
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

    // Verify owner has a passkey
    const [ownerPasskey] = await db
      .select({
        id: passkey.id,
        tempoAddress: passkey.tempoAddress,
      })
      .from(passkey)
      .where(eq(passkey.userId, session.user.id))
      .limit(1);

    if (!ownerPasskey?.tempoAddress) {
      return NextResponse.json(
        { error: 'No passkey configured. Create a passkey first.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Repo treasury uses your wallet (passkey). No separate configuration needed.',
      treasury: {
        configured: true,
        address: ownerPasskey.tempoAddress,
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
