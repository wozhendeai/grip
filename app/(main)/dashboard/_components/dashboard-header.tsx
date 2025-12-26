import type { DashboardStats } from '@/db/queries/bounties';

interface DashboardHeaderProps {
  userName: string | null;
  stats: DashboardStats;
}

/**
 * Dashboard header with title, description, and inline stats
 * Matches Explore page header styling
 */
export function DashboardHeader({ userName, stats }: DashboardHeaderProps) {
  // Format amount from micro-units (6 decimals) to display
  const formatAmount = (amountStr: string): string => {
    const amount = BigInt(amountStr);
    const whole = amount / BigInt(1_000_000);
    return `$${whole.toLocaleString()}`;
  };

  return (
    <div className="container py-12">
      <h1 className="mb-2 text-3xl font-bold md:text-4xl">Dashboard</h1>
      <p className="max-w-lg text-muted-foreground">
        Track bounties you&apos;ve created, claimed, or are watching.
      </p>

      {/* Stats Row */}
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:gap-8">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">{formatAmount(stats.earned.total)}</span>
          <span className="text-sm text-muted-foreground">earned</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">{formatAmount(stats.pending.total)}</span>
          <span className="text-sm text-muted-foreground">pending</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">{stats.created.count}</span>
          <span className="text-sm text-muted-foreground">created</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">0</span>
          <span className="text-sm text-muted-foreground">watching</span>
        </div>
      </div>
    </div>
  );
}
