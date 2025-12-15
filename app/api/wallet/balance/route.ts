import { getTokenInfo } from '@/lib/tempo/balance';
import { TEMPO_TOKENS } from '@/lib/tempo/constants';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/wallet/balance
 *
 * Query TIP-20 balance for a Tempo address.
 * Public endpoint - no auth required (balance is public on-chain).
 *
 * Query params:
 * - address: Tempo address (required)
 * - token: Token address (optional, defaults to USDC)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');
  const tokenAddress = (searchParams.get('token') ?? TEMPO_TOKENS.USDC) as `0x${string}`;

  if (!address) {
    return NextResponse.json({ error: 'Address parameter is required' }, { status: 400 });
  }

  // Validate address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: 'Invalid address format' }, { status: 400 });
  }

  try {
    const tokenInfo = await getTokenInfo(address as `0x${string}`, tokenAddress);

    return NextResponse.json({
      address,
      tokenAddress,
      balance: tokenInfo.balance.toString(),
      formattedBalance: tokenInfo.formattedBalance,
      decimals: tokenInfo.decimals,
      symbol: tokenInfo.symbol,
    });
  } catch (error) {
    console.error('Error fetching balance:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch balance',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
