import { getFunderPendingLiabilities } from '@/db/queries/pending-payments';
import { requireAuth } from '@/lib/auth/auth-server';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/wallet/liabilities
 *
 * Returns funder's pending payment liabilities (uncommitted funds).
 *
 * Use case: Show warning when wallet balance < liabilities
 * Example: Funder has 1000 USDC but 1500 USDC in pending payments
 *
 * Response:
 * {
 *   liabilities: [
 *     { tokenAddress: '0x...', total: '1500000000' }
 *   ]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Get all pending payment liabilities for this funder
    // Aggregates by token address
    const liabilities = await getFunderPendingLiabilities(session.user.id);

    // Convert bigint to string for JSON serialization
    const serializedLiabilities = liabilities.map((liability) => ({
      tokenAddress: liability.tokenAddress,
      total: liability.total.toString(),
    }));

    return NextResponse.json({ liabilities: serializedLiabilities });
  } catch (error) {
    console.error('[wallet-liabilities] Error fetching liabilities:', error);
    return NextResponse.json({ error: 'Failed to fetch liabilities' }, { status: 500 });
  }
}
