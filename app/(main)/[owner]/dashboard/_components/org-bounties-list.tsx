import { Badge } from '@/components/ui/badge';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { OrgActiveBounty } from '@/db/queries/org-dashboard';

interface OrgBountiesListProps {
  bounties: OrgActiveBounty[];
  orgSlug: string;
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

function getStatusBadge(status: OrgActiveBounty['status']) {
  switch (status) {
    case 'open':
      return (
        <Badge variant="outline" className="text-xs text-green-600 border-green-600/30">
          Open
        </Badge>
      );
    case 'claimed':
      return (
        <Badge variant="secondary" className="text-xs">
          Claimed
        </Badge>
      );
    case 'in_review':
      return (
        <Badge variant="outline" className="text-xs text-blue-600 border-blue-600/30">
          In Review
        </Badge>
      );
    case 'completed':
      return (
        <Badge variant="outline" className="text-xs text-purple-600 border-purple-600/30">
          Completed
        </Badge>
      );
  }
}

function getStatusColor(status: OrgActiveBounty['status']) {
  switch (status) {
    case 'open':
      return 'border-green-500/50 bg-green-500/10';
    case 'claimed':
      return 'border-yellow-500/50 bg-yellow-500/10';
    case 'in_review':
      return 'border-blue-500/50 bg-blue-500/10';
    case 'completed':
      return 'border-purple-500/50 bg-purple-500/10';
  }
}

function getStatusDotColor(status: OrgActiveBounty['status']) {
  switch (status) {
    case 'open':
      return 'bg-green-500';
    case 'claimed':
      return 'bg-yellow-500';
    case 'in_review':
      return 'bg-blue-500';
    case 'completed':
      return 'bg-purple-500';
  }
}

export function OrgBountiesList({ bounties, orgSlug }: OrgBountiesListProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold">Active Bounties</h3>
        <Link
          href={`/${orgSlug}/bounties`}
          className="flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View all
          <ChevronRight className="size-3 ml-0.5" />
        </Link>
      </div>

      {bounties.length === 0 ? (
        <div className="rounded-md border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No active bounties yet.</p>
          <Link
            href={`/${orgSlug}/bounties/new`}
            className="text-sm text-primary hover:underline mt-2 inline-block"
          >
            Create your first bounty
          </Link>
        </div>
      ) : (
        <div className="rounded-md border bg-card">
          {bounties.map((bounty, index) => (
            <Link
              key={bounty.id}
              href={`/${bounty.repoOwner}/${bounty.repoName}/bounties/${bounty.id}`}
              className={cn(
                'p-4 flex items-start gap-3 hover:bg-muted/30 transition-colors block',
                index !== bounties.length - 1 && 'border-b'
              )}
            >
              {/* Status indicator */}
              <div
                className={cn(
                  'mt-1 size-4 rounded-full border-2 flex items-center justify-center shrink-0',
                  getStatusColor(bounty.status)
                )}
              >
                <div className={cn('size-1.5 rounded-full', getStatusDotColor(bounty.status))} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-medium truncate">{bounty.title}</p>
                  <span className="font-mono text-sm font-medium shrink-0">
                    {formatCurrency(bounty.amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {bounty.repoOwner}/{bounty.repoName} #{bounty.issueNumber}
                  </span>
                  <div className="flex items-center gap-2">
                    {bounty.claimedByUsername && <span>@{bounty.claimedByUsername}</span>}
                    {getStatusBadge(bounty.status)}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
