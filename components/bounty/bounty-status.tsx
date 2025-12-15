import type { BountyStatus as BountyStatusType } from '@/lib/types';
import { cn } from '@/lib/utils';

interface BountyStatusProps {
  status: BountyStatusType;
  className?: string;
}

const statusConfig: Record<BountyStatusType, { label: string; colorClass: string }> = {
  open: {
    label: 'OPEN',
    colorClass: 'text-success border-success/50 bg-success/10',
  },
  completed: {
    label: 'COMPLETED',
    colorClass: 'text-muted-foreground border-border bg-secondary',
  },
  cancelled: {
    label: 'CANCELLED',
    colorClass: 'text-destructive border-destructive/50 bg-destructive/10',
  },
};

/**
 * Status Badge for bounties
 */
export function BountyStatus({ status, className }: BountyStatusProps) {
  const config = statusConfig[status] ?? statusConfig.open;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
        config.colorClass,
        className
      )}
    >
      {config.label}
    </span>
  );
}
