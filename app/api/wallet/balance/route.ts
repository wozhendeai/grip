import { tempoClient } from '@/lib/tempo/client';
import { TEMPO_TOKENS } from '@/lib/tempo/constants';
import { type NextRequest, NextResponse } from 'next/server';
import { formatUnits } from 'viem';

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
    const [balance, metadata] = await Promise.all([
      tempoClient.token.getBalance({
        account: address as `0x${string}`,
        token: tokenAddress,
      }),
      tempoClient.token.getMetadata({
        token: tokenAddress,
      }),
    ]);

    return NextResponse.json({
      address,
      tokenAddress,
      balance: balance.toString(),
      formattedBalance: formatUnits(balance, metadata.decimals),
      decimals: metadata.decimals,
      symbol: metadata.symbol,
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
