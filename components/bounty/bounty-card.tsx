'use client';

import { TokenSymbol } from '@/components/tempo/token-symbol';
import type { Bounty } from '@/lib/types';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface BountyCardProps {
  bounty: Bounty;
  variant?: 'card' | 'row';
  showRepo?: boolean;
  index?: number;
}

/**
 * Bounty Card
 *
 * Displays bounty info in card (grid) or row (list) format.
 */
export function BountyCard({
  bounty,
  variant = 'card',
  showRepo = true,
  index = 0,
}: BountyCardProps) {
  const bountyUrl = `/${bounty.project.githubOwner}/${bounty.project.githubRepo}/bounties/${bounty.id}`;
  const isCompleted = bounty.status === 'completed';
  const labels = bounty.labels ?? [];
  const totalFunded = Number(bounty.totalFunded);

  // Highlight logic: e.g. top funded or specific indices could be featured
  const isHighValue = totalFunded > 1000;

  // Status badge - shared between variants
  const statusBadge =
    bounty.status === 'completed' ? (
      <Badge
        variant="secondary"
        className="bg-success/10 text-success hover:bg-success/20 border-success/20"
      >
        Done
      </Badge>
    ) : bounty.submissions && bounty.submissions.length > 0 ? (
      <Badge
        variant="secondary"
        className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
      >
        Claimed
      </Badge>
    ) : (
      <Badge variant="outline" className="text-muted-foreground">
        Open
      </Badge>
    );

  // Row variant - compact list style
  if (variant === 'row') {
    return (
      <Link
        href={bountyUrl}
        className="group block border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center justify-between gap-4 p-4">
          <div className="flex-1 min-w-0 space-y-1">
            {showRepo && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">
                  {bounty.project.githubOwner}/{bounty.project.githubRepo}
                </span>
                <span className="mx-1.5">·</span>
                <span>#{bounty.githubIssueNumber}</span>
              </div>
            )}
            <h3 className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors line-clamp-1">
              {bounty.title}
            </h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {statusBadge}
            <span
              className={cn(
                'text-xs font-medium px-2 py-0.5 rounded-full border',
                isCompleted
                  ? 'bg-muted text-muted-foreground border-border line-through'
                  : 'bg-success/10 text-success border-success/20'
              )}
            >
              ${totalFunded.toLocaleString()}
            </span>
          </div>
        </div>
      </Link>
    );
  }

  // Card variant - full card style for grids
  return (
    <Link href={bountyUrl} className="group block h-full">
      <article className="relative flex h-full flex-col justify-between rounded-xl border border-border bg-card p-6 transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 rounded-lg border border-border bg-muted/50">
              <AvatarImage
                src={`https://github.com/${bounty.project.githubOwner}.png`}
                alt={bounty.project.githubOwner}
              />
              <AvatarFallback className="rounded-lg uppercase">
                {bounty.project.githubOwner.substring(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                {bounty.project.githubOwner}
              </div>
              <div className="text-xs text-muted-foreground/60">{bounty.project.githubRepo}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {statusBadge}
            {isHighValue && (
              <Badge
                variant="destructive"
                className="px-2 py-0.5 text-xs uppercase tracking-wider font-bold"
              >
                Hot
              </Badge>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          <h3 className="mb-4 text-lg font-semibold leading-snug group-hover:text-primary transition-colors line-clamp-3">
            {bounty.title}
          </h3>

          <div className="flex flex-wrap gap-2 mb-6">
            {labels.slice(0, 3).map((label, idx) => (
              <Badge
                key={`${label.name}-${idx}`}
                variant="secondary"
                className="rounded-md border-transparent bg-secondary/50 px-2 py-0.5 text-xs font-normal text-secondary-foreground hover:bg-secondary transition-colors"
              >
                {label.name}
              </Badge>
            ))}
            {labels.length > 3 && (
              <span className="text-xs text-muted-foreground self-center">
                +{labels.length - 3}
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-end justify-between border-t border-border/50 pt-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-0.5">
              Reward
            </div>
            <div className="flex items-baseline gap-1">
              <span
                className={cn(
                  'text-2xl font-bold tracking-tight',
                  isCompleted
                    ? 'text-muted-foreground line-through decoration-2'
                    : 'text-foreground'
                )}
              >
                ${totalFunded.toLocaleString()}
              </span>
              {!isCompleted && (
                <TokenSymbol
                  tokenAddress={bounty.tokenAddress as `0x${string}`}
                  className="text-xs font-medium text-muted-foreground"
                />
              )}
            </div>
          </div>

          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-300',
              'bg-muted/30 border-border text-muted-foreground',
              'group-hover:bg-primary group-hover:border-primary group-hover:text-primary-foreground group-hover:scale-110'
            )}
          >
            <ArrowUpRight className="h-5 w-5" />
          </div>
        </div>
      </article>
    </Link>
  );
}
