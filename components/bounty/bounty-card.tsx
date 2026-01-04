import type { Bounty } from '@/lib/types';
import Link from 'next/link';
import { BountyStatus } from './bounty-status';

interface BountyCardProps {
  bounty: Bounty;
  index?: number;
}

/**
 * Bounty Card
 *
 * Clean card design with clear status indication.
 */
export function BountyCard({ bounty, index = 0 }: BountyCardProps) {
  const bountyUrl = `/${bounty.project.githubOwner}/${bounty.project.githubRepo}/bounties/${bounty.id}`;
  const isCompleted = bounty.status === 'completed';
  const isClaimed = bounty.status === 'open' && (bounty.submissions?.length ?? 0) > 0;
  const isPaid = isCompleted;
  const labels = bounty.labels ?? [];

  return (
    <Link href={bountyUrl} className="group block">
      <article className="relative h-full overflow-hidden rounded-lg border border-border bg-card p-5 transition-colors hover:border-muted-foreground/50">
        {/* Header: Project + Status */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <code className="text-xs text-muted-foreground">{bounty.project.githubFullName}</code>
          <BountyStatus status={bounty.status} />
        </div>

        {/* Title */}
        <h3 className="mb-4 line-clamp-2 text-sm font-medium leading-snug group-hover:text-muted-foreground transition-colors">
          {bounty.title}
        </h3>

        {/* Amount - with completed state styling */}
        <div className="mb-4">
          {bounty.totalFunded === null ? (
            <span className="text-2xl font-bold text-muted-foreground">Hidden</span>
          ) : isCompleted ? (
            <div className="inline-flex items-center gap-2">
              <span className="text-2xl font-bold text-muted-foreground line-through">
                ${Number(bounty.totalFunded).toLocaleString()}
              </span>
              <span className="text-sm font-medium text-success">PAID</span>
            </div>
          ) : (
            <>
              <span className="text-2xl font-bold">
                ${Number(bounty.totalFunded).toLocaleString()}
              </span>
              <span className="ml-1 text-sm text-muted-foreground">USDC</span>
            </>
          )}
        </div>

        {/* Labels */}
        {labels.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {labels.slice(0, 2).map((label, idx) => (
              <span
                key={`${label.name}-${idx}`}
                className="inline-flex items-center rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
              >
                {label.name}
              </span>
            ))}
            {labels.length > 2 && (
              <span className="text-xs text-muted-foreground">+{labels.length - 2}</span>
            )}
          </div>
        )}

        {/* Footer: Issue number + status hint */}
        <div className="flex items-center justify-between border-t border-border pt-3">
          {isClaimed ? (
            <span className="text-xs text-warning">In Progress</span>
          ) : !isPaid ? (
            <span className="text-xs text-muted-foreground">Available</span>
          ) : (
            <span />
          )}
          <span className="text-xs text-muted-foreground">#{bounty.githubIssueNumber}</span>
        </div>
      </article>
    </Link>
  );
}
