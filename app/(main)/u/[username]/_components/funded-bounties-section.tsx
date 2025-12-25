import { BountyStatus } from '@/components/bounty/bounty-status';
import type { BountyStatus as BountyStatusType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { formatUnits } from 'viem';

interface FundedBountiesSectionProps {
  bounties: Array<{
    id: string;
    title: string;
    amount: bigint; // Amount is BigInt from database
    status: string;
    repoOwner: string;
    repoName: string;
    createdAt: string | null;
  }>;
}

/* Status-specific border and background styles for cards
   Using muted colors for inactive statuses, vibrant for active ones */
const statusStyles: Record<BountyStatusType, string> = {
  open: 'border-success/50 hover:border-success bg-success/5',
  completed: 'border-border hover:border-muted-foreground/50 bg-secondary/50',
  cancelled: 'border-destructive/50 hover:border-destructive bg-destructive/5',
};

/* Status group badge colors for the count indicator */
const statusBadgeColors: Record<BountyStatusType, string> = {
  open: 'bg-success/20 text-success',
  completed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/20 text-destructive',
};

export function FundedBountiesSection({ bounties }: FundedBountiesSectionProps) {
  // Order statuses by relevance (active first, then inactive)
  const statusOrder: BountyStatusType[] = ['open', 'completed', 'cancelled'];

  // Group bounties by status
  const grouped = bounties.reduce(
    (acc, bounty) => {
      const status = bounty.status as BountyStatusType;
      if (!acc[status]) acc[status] = [];
      acc[status].push(bounty);
      return acc;
    },
    {} as Record<BountyStatusType, typeof bounties>
  );

  return (
    <div>
      <h2 className="mb-6 text-sm font-medium text-muted-foreground">Funded Bounties</h2>

      {statusOrder.map((status, groupIndex) => {
        const items = grouped[status];
        if (!items || items.length === 0) return null;

        return (
          <div key={status} className="mb-8 last:mb-0">
            {/* Status Group Header */}
            <div className="mb-3 flex items-center gap-2">
              <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                {status.replace(/_/g, ' ')}
              </h3>
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold',
                  statusBadgeColors[status as BountyStatusType]
                )}
              >
                {items.length}
              </span>
            </div>

            {/* Bounty Cards Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items
                .filter((bounty) => bounty.repoOwner && bounty.repoName)
                .map((bounty, cardIndex) => (
                  <Link
                    key={bounty.id}
                    href={`/${bounty.repoOwner}/${bounty.repoName}/bounties/${bounty.id}`}
                    className={cn(
                      'group relative block rounded-lg border bg-card p-4 transition-all duration-200 hover:scale-[1.02]',
                      statusStyles[bounty.status as BountyStatusType]
                    )}
                  >
                    {/* Pulse indicator for active bounties (open/claimed) */}
                    {(bounty.status === 'open' || bounty.status === 'claimed') && (
                      <div className="absolute -right-1 -top-1 h-2 w-2">
                        <div className="h-full w-full animate-pulse rounded-full bg-success" />
                      </div>
                    )}

                    {/* Status Badge */}
                    <div className="mb-2">
                      <BountyStatus status={bounty.status as BountyStatusType} />
                    </div>

                    {/* Repo Name */}
                    <code className="mb-2 block font-mono text-xs text-muted-foreground">
                      {bounty.repoOwner}/{bounty.repoName}
                    </code>

                    {/* Bounty Title */}
                    <h4 className="mb-3 font-medium transition-colors group-hover:text-muted-foreground line-clamp-2">
                      {bounty.title}
                    </h4>

                    {/* Amount and Arrow */}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono text-lg font-bold text-foreground">
                          ${formatUnits(BigInt(bounty.amount), 6)}
                        </span>
                        <span className="ml-1 font-mono text-xs text-muted-foreground">USDC</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
