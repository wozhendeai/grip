import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { DashboardStats } from '@/db/queries/bounties';
import { CheckCircle2, Clock, Coins } from 'lucide-react';

interface OverviewStatsProps {
  stats: DashboardStats;
}

export function OverviewStats({ stats }: OverviewStatsProps) {
  // Only show stats if they have non-zero values
  const hasEarnings = BigInt(stats.earned.total) > 0;
  const hasPending = BigInt(stats.pending.total) > 0;
  const hasCreated = BigInt(stats.created.total) > 0;

  if (!hasEarnings && !hasPending && !hasCreated) {
    return null;
  }

  return (
    <Card className="flex flex-col h-full bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Your Overview</CardTitle>
        <CardDescription>Lifetime stats on GRIP</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-center gap-6">
        {/* Earned */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Coins className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Earned</p>
              <p className="text-2xl font-bold tracking-tight">
                ${BigInt(stats.earned.total).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="border-t border-border/40" />

        <div className="grid grid-cols-2 gap-4">
          {/* Pending */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">Pending</span>
            </div>
            <p className="text-lg font-semibold">${BigInt(stats.pending.total).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{stats.pending.count} submissions</p>
          </div>

          {/* Funded */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">Funded</span>
            </div>
            <p className="text-lg font-semibold">${BigInt(stats.created.total).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{stats.created.count} bounties</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
