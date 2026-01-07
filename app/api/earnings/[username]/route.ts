import { type TimePeriod, getUserEarningsOverTime } from '@/db/queries/payouts';
import { getUserByName } from '@/db/queries/users';
import { handleRouteError } from '@/app/api/_lib';
import type { NextRequest } from 'next/server';

/**
 * GET /api/earnings/[username]
 *
 * Fetch earnings chart data for a user's profile page.
 * Public endpoint - returns time-series data of confirmed payouts.
 */
export async function GET(request: NextRequest, ctx: RouteContext<'/api/earnings/[username]'>) {
  try {
    const { username } = await ctx.params;
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') as TimePeriod) ?? '1y';

    const user = await getUserByName(username);
    const userId = user?.id ?? null;

    const earnings = await getUserEarningsOverTime(userId, period);

    return Response.json({
      earnings: earnings.map((e) => ({
        date: e.date,
        amount: e.amount,
      })),
    });
  } catch (error) {
    return handleRouteError(error, 'fetching user earnings');
  }
}
