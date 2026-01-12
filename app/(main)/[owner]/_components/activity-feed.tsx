'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
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
import {
  CheckCircle2,
  DollarSign,
  Zap,
  Activity,
  type LucideIcon,
} from 'lucide-react';
import { formatUnits } from 'viem';
import Link from 'next/link';

export type ActivityType = 'completed' | 'funded' | 'in_progress';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string | null;
  repoOwner: string | null;
  repoName: string | null;
  amount: string | number | bigint;
  date: string | Date | null;
  url: string;
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  filter: string;
  searchQuery: string;
}

const PAGE_SIZE = 10;

function formatRelativeTime(date: Date): string {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const diffMs = date.getTime() - Date.now();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (Math.abs(diffDays) < 1) return 'today';
  if (Math.abs(diffDays) < 7) return rtf.format(diffDays, 'day');
  if (Math.abs(diffDays) < 30) return rtf.format(Math.round(diffDays / 7), 'week');
  if (Math.abs(diffDays) < 365) return rtf.format(Math.round(diffDays / 30), 'month');
  return rtf.format(Math.round(diffDays / 365), 'year');
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

function getActivityIcon(type: ActivityType): LucideIcon {
  switch (type) {
    case 'completed':
      return CheckCircle2;
    case 'funded':
      return DollarSign;
    case 'in_progress':
      return Zap;
  }
}

function getActivityIconClass(type: ActivityType) {
  switch (type) {
    case 'completed':
      return 'bg-green-500/10 text-green-600 rounded-full p-2';
    case 'funded':
      return 'bg-blue-500/10 text-blue-600 rounded-full p-2';
    case 'in_progress':
      return 'bg-yellow-500/10 text-yellow-600 rounded-full p-2';
  }
}

function getActivityLabel(type: ActivityType, repoOwner: string | null, repoName: string | null) {
  const repoRef = repoOwner && repoName ? `${repoOwner}/${repoName}` : 'unknown';
  switch (type) {
    case 'completed':
      return `Completed bounty on ${repoRef}`;
    case 'funded':
      return `Funded bounty on ${repoRef}`;
    case 'in_progress':
      return `Claimed bounty on ${repoRef}`;
  }
}

export function ActivityFeed({ activities, filter, searchQuery }: ActivityFeedProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filteredActivities = useMemo(() => {
    let result = activities;

    // Apply type filter
    if (filter !== 'all') {
      result = result.filter((activity) => activity.type === filter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (activity) =>
          activity.title?.toLowerCase().includes(query) ||
          activity.repoOwner?.toLowerCase().includes(query) ||
          activity.repoName?.toLowerCase().includes(query)
      );
    }

    // Sort by date descending
    return [...result].sort((a, b) => {
      const timeA = a.date ? new Date(a.date).getTime() : 0;
      const timeB = b.date ? new Date(b.date).getTime() : 0;
      return timeB - timeA;
    });
  }, [activities, filter, searchQuery]);

  const visibleActivities = filteredActivities.slice(0, visibleCount);
  const hasMore = visibleCount < filteredActivities.length;

  if (filteredActivities.length === 0) {
    return (
      <Empty className="py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Activity strokeWidth={1.5} />
          </EmptyMedia>
          <EmptyTitle>No activity found</EmptyTitle>
          <EmptyDescription>
            {searchQuery
              ? 'Try adjusting your search query.'
              : filter !== 'all'
                ? 'No activity matches this filter.'
                : 'Activity will appear here once you start working on bounties.'}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      <ItemGroup className="gap-0">
        {visibleActivities.map((activity, index) => {
          const Icon = getActivityIcon(activity.type);
          return (
            <div key={`${activity.type}-${activity.id}`}>
              {index > 0 && <ItemSeparator />}
              <Link href={activity.url} className="block">
                <Item className="py-3 transition-colors hover:bg-muted/50">
                  <ItemMedia variant="icon" className={getActivityIconClass(activity.type)}>
                    <Icon className="size-4" strokeWidth={2} />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {getActivityLabel(activity.type, activity.repoOwner, activity.repoName)}
                      </span>
                      <span
                        className={cn(
                          'font-mono text-xs tabular-nums',
                          activity.type === 'funded'
                            ? 'text-muted-foreground'
                            : 'font-medium text-green-600'
                        )}
                      >
                        {activity.type === 'funded' ? '-' : '+'}
                        {formatCurrency(activity.amount)}
                      </span>
                    </ItemTitle>
                    <ItemDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      {activity.title && (
                        <span className="max-w-[300px] truncate">{activity.title}</span>
                      )}
                      {activity.date && (
                        <span className="text-muted-foreground/60">
                          {formatRelativeTime(new Date(activity.date))}
                        </span>
                      )}
                    </ItemDescription>
                  </ItemContent>
                </Item>
              </Link>
            </div>
          );
        })}
      </ItemGroup>

      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-4 w-full text-muted-foreground hover:text-foreground"
          onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
        >
          Load More
        </Button>
      )}
    </div>
  );
}
