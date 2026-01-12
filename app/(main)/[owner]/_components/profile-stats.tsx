import {
  CheckCircle2,
  DollarSign,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { formatUnits } from 'viem';
import { cn } from '@/lib/utils';

interface StatItemProps {
  label: string;
  value: string | number;
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

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
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

interface ProfileStatsProps {
  bountiesCompleted: number;
  totalEarned: bigint;
  activeClaims: number;
}

export function ProfileStats({ bountiesCompleted, totalEarned, activeClaims }: ProfileStatsProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <StatItem
        label="Bounties"
        value={formatNumber(bountiesCompleted)}
        icon={CheckCircle2}
        iconColor="text-green-600"
      />
      <StatItem
        label="Earned"
        value={formatCurrency(totalEarned)}
        icon={DollarSign}
        iconColor="text-primary"
      />
      <StatItem
        label="Active"
        value={activeClaims}
        icon={Zap}
        iconColor="text-yellow-600"
      />
    </div>
  );
}
