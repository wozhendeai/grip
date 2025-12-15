import { getSession } from '@/lib/auth-server';
import { getPasskeysByUser } from '@/lib/db/queries/passkeys';
import { TEMPO_RPC_URL } from '@/lib/tempo/constants';
import { type NextRequest, NextResponse } from 'next/server';
import { tempo } from 'tempo.ts/chains';
import { tempoActions } from 'tempo.ts/viem';
import { http, createClient, publicActions } from 'viem';

/**
 * POST /api/wallet/faucet
 *
 * Requests test tokens from the Tempo faucet (testnet only).
 *
 * Flow:
 * 1. Verify testnet environment
 * 2. Validate user session and wallet
 * 3. Call faucet using Tempo SDK
 * 4. Return transaction hashes
 *
 * Returns:
 * - success: { success: true, txHashes: string[], message: string }
 * - error: { error: string, retryAfter?: number }
 */
export async function POST(req: NextRequest) {
  // CRITICAL: Faucet only available on testnet
  if (process.env.NEXT_PUBLIC_TEMPO_NETWORK !== 'testnet') {
    return NextResponse.json({ error: 'Faucet is only available on testnet' }, { status: 403 });
  }

  // Verify user authentication
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Get user's passkey wallet
  const passkeys = await getPasskeysByUser(session.user.id);
  if (!passkeys || passkeys.length === 0) {
    return NextResponse.json(
      { error: 'Wallet required. Please create a passkey wallet first.' },
      { status: 400 }
    );
  }

  const wallet = passkeys[0];

  try {
    // Create Tempo client with faucet actions
    // Using AlphaUSD as fee token (0x20c0...0001)
    const client = createClient({
      chain: tempo({ feeToken: '0x20c0000000000000000000000000000000000001' as `0x${string}` }),
      transport: http(TEMPO_RPC_URL),
    })
      .extend(publicActions)
      .extend(tempoActions());

    // Call faucet to fund all test tokens at once
    // This funds: pathUSD, AlphaUSD, BetaUSD, ThetaUSD
    const txHashes = await client.faucet.fund({
      account: wallet.tempoAddress as `0x${string}`,
    });

    return NextResponse.json({
      success: true,
      txHashes,
      message: 'Successfully funded wallet with test tokens (AlphaUSD, BetaUSD, ThetaUSD, PathUSD)',
    });
  } catch (error: unknown) {
    console.error('Faucet error:', error);

    // Handle rate limiting
    // Tempo faucet limits: 1 request per address per 24 hours
    if (error instanceof Error && error.message.toLowerCase().includes('rate limit')) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. Faucet allows one request per address every 24 hours.',
          retryAfter: 86400, // 24 hours in seconds
        },
        { status: 429 }
      );
    }

    // Handle other errors
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Faucet request failed. Please try again.',
      },
      { status: 500 }
    );
  }
}
