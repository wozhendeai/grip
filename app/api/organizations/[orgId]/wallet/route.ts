import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-server';
import { getOrgWalletAddress, isOrgMember } from '@/db/queries/organizations';
import { getCurrentNetwork } from '@/db/network';
import { TEMPO_TOKENS } from '@/lib/tempo/constants';
import { getTokenMetadata } from '@/lib/tempo/tokens';

type RouteContext = {
  params: Promise<{ orgId: string }>;
};

/**
 * GET /api/organizations/[orgId]/wallet
 *
 * Get organization wallet address and token metadata (members can view)
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth();
    const { orgId } = await context.params;

    if (!(await isOrgMember(orgId, session.user.id))) {
      return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    const address = await getOrgWalletAddress(orgId);
    const metadata = await getTokenMetadata(TEMPO_TOKENS.USDC);

    return NextResponse.json({
      address,
      network: getCurrentNetwork(),
      tokenAddress: TEMPO_TOKENS.USDC,
      tokenDecimals: metadata.decimals,
      tokenSymbol: metadata.symbol,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error getting org wallet:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get wallet' },
      { status: 500 }
    );
  }
}
