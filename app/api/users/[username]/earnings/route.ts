import { type TimePeriod, getUserEarningsOverTime } from '@/lib/db/queries/payouts';
import { getUserByName } from '@/lib/db/queries/users';
import { type NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') as TimePeriod) ?? '1y';

    const user = await getUserByName(username);
    const userId = user?.id ?? null;

    const earnings = await getUserEarningsOverTime(userId, period);

    return NextResponse.json({
      earnings: earnings.map((e) => ({
        date: e.date,
        amount: e.amount,
      })),
    });
  } catch (error) {
    console.error('Error fetching user earnings:', error);
    return NextResponse.json({ error: 'Failed to fetch user earnings' }, { status: 500 });
  }
}
