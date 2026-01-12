'use client';

import { Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { cn } from '@/lib/utils';
import { formatUnits } from 'viem';
import Link from 'next/link';

export type BountyStatus = 'open' | 'claimed' | 'in_review' | 'completed' | 'cancelled';

export interface OrgBountyItem {
  id: string;
  title: string | null;
  amount: bigint;
  status: BountyStatus;
  githubOwner: string;
  githubRepo: string;
  githubIssueNumber: number;
}

interface OrgBountiesListProps {
  bounties: OrgBountyItem[];
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

function getStatusColor(status: BountyStatus): { dot: string; badge: string; text: string } {
  switch (status) {
    case 'open':
      return {
        dot: 'bg-green-500',
        badge: 'text-green-600 border-green-600/30',
        text: 'Open',
      };
    case 'claimed':
    case 'in_review':
      return {
        dot: 'bg-yellow-500',
        badge: 'text-yellow-600 border-yellow-600/30',
        text: status === 'claimed' ? 'Claimed' : 'In Review',
      };
    case 'completed':
      return {
        dot: 'bg-blue-500',
        badge: 'text-blue-600 border-blue-600/30',
        text: 'Completed',
      };
    case 'cancelled':
      return {
        dot: 'bg-gray-500',
        badge: 'text-gray-600 border-gray-600/30',
        text: 'Cancelled',
      };
    default:
      return {
        dot: 'bg-gray-500',
        badge: 'text-gray-600 border-gray-600/30',
        text: status,
      };
  }
}

export function OrgBountiesList({ bounties }: OrgBountiesListProps) {
  // Only show open or claimed bounties in the bounties tab
  const openBounties = bounties.filter((b) => b.status === 'open' || b.status === 'claimed');

  if (openBounties.length === 0) {
    return (
      <Empty className="border-0 py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="h-10 w-10 text-muted-foreground/30">
            <Zap strokeWidth={1.5} />
          </EmptyMedia>
          <EmptyTitle className="text-sm font-normal text-muted-foreground">
            No open bounties at the moment.
          </EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="rounded-md border bg-card">
      {openBounties.map((bounty, index) => {
        const statusStyle = getStatusColor(bounty.status);
        return (
          <Link
            key={bounty.id}
            href={`/${bounty.githubOwner}/${bounty.githubRepo}/bounties/${bounty.id}`}
            className={cn(
              'block p-4 hover:bg-muted/30 transition-colors',
              index !== openBounties.length - 1 && 'border-b'
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'mt-1 size-4 rounded-full border-2 flex items-center justify-center',
                  bounty.status === 'open'
                    ? 'border-green-500/50 bg-green-500/10'
                    : 'border-yellow-500/50 bg-yellow-500/10'
                )}
              >
                <div className={cn('size-1.5 rounded-full', statusStyle.dot)} />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-medium truncate">
                    {bounty.title || 'Untitled Bounty'}
                  </p>
                  <span className="font-mono text-sm font-semibold text-primary shrink-0">
                    {formatCurrency(bounty.amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {bounty.githubOwner}/{bounty.githubRepo} #{bounty.githubIssueNumber}
                  </span>
                  <Badge variant="outline" className={cn('text-xs', statusStyle.badge)}>
                    {statusStyle.text}
                  </Badge>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
