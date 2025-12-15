import { BountyStatus } from '@/components/bounty/bounty-status';
import { formatTokenAmount } from '@/lib/tempo/format';
import type { Bounty } from '@/lib/types';
import Link from 'next/link';

/**
 * BountyListItem - Row-based bounty display for the /bounties page
 *
 * Design decision: List view (not cards) matches MeritSystems bounties page.
 * More information density, better for scanning many bounties at once.
 * Links to bounty detail page/modal.
 *
 * Animation: Uses staggered fade-in-up animation. Pass index prop for delay.
 */

interface BountyListItemProps {
  bounty: Bounty;
  /** Index for staggered animation delay (50ms per item) */
  index?: number;
}

export function BountyListItem({ bounty, index = 0 }: BountyListItemProps) {
  const href = `/${bounty.project.githubOwner}/${bounty.project.githubRepo}/bounties/${bounty.id}`;

  return (
    <Link
      href={href}
      className="group flex items-start gap-4 border-b border-border py-4 transition-colors hover:bg-muted/50 px-4 -mx-4 animate-fade-in-up opacity-0"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Repo Avatar */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-xs font-bold uppercase">
        {bounty.project.githubOwner.slice(0, 2)}
      </div>

      {/* Main Content */}
      <div className="min-w-0 flex-1">
        {/* Repo + Issue Number */}
        <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground group-hover:text-primary transition-colors">
            {bounty.project.githubFullName}
          </span>
          <span>#{bounty.githubIssueNumber}</span>
        </div>

        {/* Title */}
        <h3 className="mb-1 font-medium leading-snug line-clamp-1">{bounty.title}</h3>

        {/* Description */}
        {bounty.body && <p className="text-sm text-muted-foreground line-clamp-1">{bounty.body}</p>}
      </div>

      {/* Right Side: Amount + Status */}
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="text-xl font-bold text-success">
          ${formatTokenAmount(bounty.totalFunded, { trim: true })}
        </span>
        <BountyStatus status={bounty.status} />
      </div>
    </Link>
  );
}

export function BountyListItemSkeleton() {
  return (
    <div className="flex items-start gap-4 border-b border-border py-4 px-4 -mx-4">
      <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-muted" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <div className="h-6 w-20 animate-pulse rounded bg-muted" />
        <div className="h-5 w-16 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
