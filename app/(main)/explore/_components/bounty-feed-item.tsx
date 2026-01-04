import type { Bounty } from '@/lib/types';
import { formatTimeAgo } from '@/lib/utils';
import Link from 'next/link';
import { formatUnits } from 'viem';

interface BountyFeedItemProps {
  bounty: Bounty;
  index?: number;
}

const labelColorMap: Record<string, string> = {
  bug: 'bg-destructive/10 text-destructive',
  enhancement: 'bg-primary/10 text-primary',
  'good first issue': 'bg-success/10 text-success',
  'good-first-issue': 'bg-success/10 text-success',
  documentation: 'bg-accent text-accent-foreground',
  'help wanted': 'bg-warning/10 text-warning',
  question: 'bg-secondary text-secondary-foreground',
};

function getLabelColor(labelName: string | undefined): string {
  if (!labelName) return 'bg-muted text-muted-foreground';
  const normalized = labelName.toLowerCase();
  return labelColorMap[normalized] || 'bg-muted text-muted-foreground';
}

export function BountyFeedItem({ bounty }: BountyFeedItemProps) {
  const bountyUrl = `/${bounty.project.githubOwner}/${bounty.project.githubRepo}/bounties/${bounty.id}`;
  const labels = (bounty.labels ?? []).filter((label) => label?.name);
  const displayLabels = labels.slice(0, 3);
  const remainingCount = labels.length - 3;

  const amountInUsdc = bounty.totalFunded
    ? Number(formatUnits(BigInt(bounty.totalFunded), 6))
    : null;

  return (
    <Link href={bountyUrl} className="group block">
      <article className="space-y-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-muted-foreground/50">
        {/* Header: Icon + Repo + Issue # + Amount */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold uppercase text-muted-foreground">
              {bounty.githubOwner.slice(0, 2)}
            </div>
            <div className="min-w-0">
              <div className="text-sm text-muted-foreground">
                {bounty.project.githubFullName} · #{bounty.githubIssueNumber}
              </div>
            </div>
          </div>
          <div className="shrink-0 text-lg font-semibold text-success">
            {amountInUsdc !== null
              ? `$${amountInUsdc.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              : 'Hidden'}
          </div>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-foreground">{bounty.title}</h3>

        {/* Description preview */}
        {bounty.body && <p className="line-clamp-2 text-sm text-muted-foreground">{bounty.body}</p>}

        {/* Footer: Tags + Timestamp */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {displayLabels.map((label, idx) => (
              <span
                key={`${label.name}-${idx}`}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${getLabelColor(label.name)}`}
              >
                {label.name}
              </span>
            ))}
            {remainingCount > 0 && (
              <span className="text-xs text-muted-foreground">+{remainingCount} more</span>
            )}
          </div>
          {bounty.createdAt && (
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
              Posted {formatTimeAgo(bounty.createdAt)}
            </span>
          )}
        </div>
      </article>
    </Link>
  );
}
