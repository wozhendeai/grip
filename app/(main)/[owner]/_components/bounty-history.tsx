'use client';

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from '@/components/ui/item';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { cn } from '@/lib/utils';
import { CheckCircle2, Zap, Wallet } from 'lucide-react';
import { formatUnits } from 'viem';
import Link from 'next/link';

export type BountyStatus = 'completed' | 'active';

export interface BountyItem {
  id: string;
  status: BountyStatus;
  title: string | null;
  repoOwner: string | null;
  repoName: string | null;
  amount: string | number | bigint;
  date: string | Date | null;
  url: string;
}

interface BountyHistoryProps {
  bounties: BountyItem[];
  filter: string;
  searchQuery: string;
}

function formatCurrency(amount: string | number | bigint): string {
  const amountBigInt = typeof amount === 'bigint' ? amount : BigInt(amount.toString());
  const dollars = Number(formatUnits(amountBigInt, 6));
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(dollars);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function BountyHistory({ bounties, filter, searchQuery }: BountyHistoryProps) {
  const filteredBounties = useMemo(() => {
    let result = bounties;

    // Apply status filter
    if (filter === 'active') {
      result = result.filter((bounty) => bounty.status === 'active');
    } else if (filter === 'completed') {
      result = result.filter((bounty) => bounty.status === 'completed');
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (bounty) =>
          bounty.title?.toLowerCase().includes(query) ||
          bounty.repoOwner?.toLowerCase().includes(query) ||
          bounty.repoName?.toLowerCase().includes(query)
      );
    }

    // Sort by date descending
    return [...result].sort((a, b) => {
      const timeA = a.date ? new Date(a.date).getTime() : 0;
      const timeB = b.date ? new Date(b.date).getTime() : 0;
      return timeB - timeA;
    });
  }, [bounties, filter, searchQuery]);

  if (filteredBounties.length === 0) {
    return (
      <Empty className="py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Wallet strokeWidth={1.5} />
          </EmptyMedia>
          <EmptyTitle>No bounties found</EmptyTitle>
          <EmptyDescription>
            {searchQuery
              ? 'Try adjusting your search query.'
              : filter !== 'all'
                ? 'No bounties match this filter.'
                : 'Bounties will appear here once you start working on them.'}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ItemGroup className="gap-0">
      {filteredBounties.map((bounty, index) => (
        <div key={bounty.id}>
          {index > 0 && <ItemSeparator />}
          <Link href={bounty.url} className="block">
            <Item className="cursor-pointer py-3 transition-colors hover:bg-muted/50">
              <ItemMedia
                variant="icon"
                className={cn(
                  'rounded-full p-2',
                  bounty.status === 'completed'
                    ? 'bg-green-500/10 text-green-600'
                    : 'bg-yellow-500/10 text-yellow-600'
                )}
              >
                {bounty.status === 'completed' ? (
                  <CheckCircle2 className="size-4" strokeWidth={2} />
                ) : (
                  <Zap className="size-4" strokeWidth={2} />
                )}
              </ItemMedia>
              <ItemContent>
                <ItemTitle className="flex items-center justify-between">
                  <span className="truncate text-sm font-medium">
                    {bounty.repoOwner}/{bounty.repoName}
                  </span>
                  <Badge variant="outline" className="shrink-0 font-mono text-xs">
                    {formatCurrency(bounty.amount)}
                  </Badge>
                </ItemTitle>
                <ItemDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  {bounty.title && (
                    <span className="max-w-[300px] truncate">{bounty.title}</span>
                  )}
                  <span className="shrink-0 text-muted-foreground/60">
                    {bounty.status === 'completed'
                      ? `Completed ${bounty.date ? formatDate(new Date(bounty.date)) : ''}`
                      : 'Active'}
                  </span>
                </ItemDescription>
              </ItemContent>
            </Item>
          </Link>
        </div>
      ))}
    </ItemGroup>
  );
}
