import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-server';
import { getOrgWalletAddress } from '@/db/queries/organizations';
import { auth } from '@/lib/auth/auth';
import { getNetworkName } from '@/db/network';
import { tempoClient } from '@/lib/tempo/client';
import { getTokenMetadata } from '@/lib/tempo/tokens';
import { headers } from 'next/headers';

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
    await requireAuth();
    const { orgId } = await context.params;

    const headersList = await headers();
    const hasPermission = await auth.api.hasPermission({
      headers: headersList,
      body: { permissions: { member: ['read'] }, organizationId: orgId },
    });
    if (!hasPermission?.success) {
      return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    const address = await getOrgWalletAddress(orgId);

    // Get org owner's fee token preference
    const userFeeToken = address
      ? await tempoClient.fee.getUserToken({ account: address as `0x${string}` })
      : null;
    const tokenAddress = userFeeToken?.address as `0x${string}` | undefined;

    if (tokenAddress) {
      const metadata = await getTokenMetadata(tokenAddress);
      return NextResponse.json({
        address,
        network: getNetworkName(),
        tokenAddress,
        tokenDecimals: metadata.decimals,
        tokenSymbol: metadata.symbol,
      });
    }

    // No fee token set - return without token info
    return NextResponse.json({
      address,
      network: getNetworkName(),
      tokenAddress: undefined,
      tokenDecimals: undefined,
      tokenSymbol: undefined,
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
