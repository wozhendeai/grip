/* Using client component for ContributionsChart because:
   - Time period selector needs client state (useState + onClick handlers)
   - Recharts library requires DOM hydration on client
   - Re-fetches chart data when period changes (dynamic interaction)
   Initial data passed from server for default period (1y) to avoid client fetch on mount.
   Trade-off: Faster initial render + better Core Web Vitals vs. slightly more complex prop interface
*/
'use client';

import { Empty, EmptyDescription } from '@/components/ui/empty';
import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/**
 * ContributionsChart - Area chart showing user earnings over time
 *
 * Design decisions:
 * - Gradient fill matching MeritSystems aesthetic
 * - Time period selector buttons (1m, 3m, 6m, 1y, 2y, All)
 * - Cumulative view to show growth over time
 * - Uses CSS variables for theming (works in both light/dark mode)
 * - Server-side initial data (1y period) for faster first render
 * - Client-side fetch only when user changes time period
 */

type TimePeriod = '1m' | '3m' | '6m' | '1y' | '2y' | 'all';

interface EarningsData {
  date: string;
  amount: number;
}

interface ContributionsChartProps {
  username: string;
  initialData?: EarningsData[];
  initialPeriod?: TimePeriod;
}

const TIME_PERIODS: { value: TimePeriod; label: string }[] = [
  { value: '1m', label: '1m' },
  { value: '3m', label: '3m' },
  { value: '6m', label: '6m' },
  { value: '1y', label: '1y' },
  { value: '2y', label: '2y' },
  { value: 'all', label: 'All' },
];

export function ContributionsChart({
  username,
  initialData = [],
  initialPeriod = '1y',
}: ContributionsChartProps) {
  const [data, setData] = useState<EarningsData[]>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [period, setPeriod] = useState<TimePeriod>(initialPeriod);

  useEffect(() => {
    // Skip fetch if using initial data for initial period
    if (period === initialPeriod && initialData.length > 0) {
      return;
    }

    async function fetchEarnings() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/users/${username}/earnings?period=${period}`);
        if (!res.ok) {
          throw new Error('Failed to fetch earnings');
        }
        const json = await res.json();
        setData(json.earnings ?? []);
      } catch (error) {
        console.error('Error fetching user earnings:', error);
        setData([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchEarnings();
  }, [username, period, initialPeriod, initialData]);

  // Calculate cumulative earnings for the chart
  const chartData = useMemo(() => {
    let cumulative = 0;
    return data.map((item) => {
      cumulative += item.amount;
      return {
        date: item.date,
        amount: item.amount,
        cumulative,
      };
    });
  }, [data]);

  const totalEarnings = chartData.length > 0 ? chartData[chartData.length - 1].cumulative : 0;

  // Show empty state if no data and not loading
  if (!isLoading && data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Earnings</p>
            <p className="text-3xl font-bold">$0</p>
          </div>

          {/* Period Selector - DISABLED */}
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1 opacity-50">
            {TIME_PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                disabled
                className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground cursor-not-allowed"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Empty State in Chart Area */}
        <div className="h-48 flex items-center justify-center">
          <div className="text-center">
            <EmptyDescription>No earnings to display</EmptyDescription>
            <p className="mt-1 text-xs text-muted-foreground">
              Earnings from completed bounties will appear here
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Earnings</p>
          <p className="text-3xl font-bold">
            {isLoading
              ? '-'
              : `$${totalEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
          {TIME_PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                period === p.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-48">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString('en-US', { month: 'short' });
                }}
                interval="preserveStartEnd"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value) => `$${value}`}
                width={50}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0].payload;
                  return (
                    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-md">
                      <p className="text-muted-foreground">
                        {new Date(item.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                      <p className="font-medium text-success">
                        $
                        {item.cumulative.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke="hsl(var(--success))"
                strokeWidth={2}
                fill="url(#earningsGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
