import { DollarSign, Zap, GitCommit } from 'lucide-react';
import { StatCard } from './stat-card';
import type { DashboardStats } from '@/db/queries/dashboard';

type StatsRowProps = {
  stats: DashboardStats;
};

function formatCurrency(cents: string | number): string {
  const value = typeof cents === 'string' ? Number(cents) : cents;
  // Amounts are stored with 6 decimals (like USDC)
  const dollars = value / 1_000_000;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(dollars);
}

export function StatsRow({ stats }: StatsRowProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <StatCard
        label="Total Earned"
        value={formatCurrency(stats.totalEarned)}
        icon={DollarSign}
        iconClassName="size-4 text-green-500"
      />
      <StatCard
        label="Active Bounties"
        value={stats.activeBounties}
        icon={Zap}
        iconClassName="size-4 text-amber-500"
      />
      <StatCard
        label="Contributions"
        value={stats.contributions}
        icon={GitCommit}
        iconClassName="size-4 text-blue-500"
      />
    </div>
  );
}
