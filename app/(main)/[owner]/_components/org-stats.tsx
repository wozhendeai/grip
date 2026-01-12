'use client';

import { DollarSign, Users, GitBranch, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatUnits } from 'viem';

interface StatItemProps {
  label: string;
  value: string;
  icon: LucideIcon;
  iconColor: string;
}

function StatItem({ label, value, icon: Icon, iconColor }: StatItemProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-border px-4 py-4">
      <Icon className={cn('size-5', iconColor)} strokeWidth={2} />
      <span className="text-2xl font-bold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

interface OrgStatsProps {
  totalFunded: bigint;
  memberCount: number;
  repoCount: number;
  className?: string;
}

function formatCurrency(amount: bigint): string {
  const dollars = Number(formatUnits(amount, 6));
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(dollars);
}

export function OrgStats({ totalFunded, memberCount, repoCount, className }: OrgStatsProps) {
  return (
    <div className={cn('grid grid-cols-3 gap-3', className)}>
      <StatItem
        label="Total Funded"
        value={formatCurrency(totalFunded)}
        icon={DollarSign}
        iconColor="text-green-600"
      />
      <StatItem
        label="Members"
        value={memberCount.toString()}
        icon={Users}
        iconColor="text-blue-600"
      />
      <StatItem
        label="Repositories"
        value={repoCount.toString()}
        icon={GitBranch}
        iconColor="text-purple-600"
      />
    </div>
  );
}
