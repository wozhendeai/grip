import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Zap, Users, GitBranch } from 'lucide-react';
import type { OrgDashboardStats } from '@/db/queries/org-dashboard';

interface OrgStatsRowProps {
  stats: OrgDashboardStats;
}

function formatCurrency(amount: bigint): string {
  const dollars = Number(amount) / 1_000_000;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(dollars);
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

export function OrgStatsRow({ stats }: OrgStatsRowProps) {
  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total Funded"
        value={formatCurrency(stats.totalFunded)}
        icon={<DollarSign className="size-4 text-green-500" />}
      />
      <StatCard
        label="Active Bounties"
        value={stats.activeBounties}
        icon={<Zap className="size-4 text-amber-500" />}
      />
      <StatCard
        label="Team Members"
        value={stats.memberCount}
        icon={<Users className="size-4 text-blue-500" />}
      />
      <StatCard
        label="Repositories"
        value={stats.repoCount}
        icon={<GitBranch className="size-4 text-purple-500" />}
      />
    </div>
  );
}
