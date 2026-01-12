'use client';

import { Fragment } from 'react';
import { formatUnits } from 'viem';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Globe, Zap, CheckCircle2, UserPlus, DollarSign } from 'lucide-react';
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from '@/components/ui/item';
import type { ActivityItem } from './activity-feed';

interface OrgActivityProps {
  items: ActivityItem[];
}

function formatRelativeTime(date: Date) {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const diffMs = date.getTime() - Date.now();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (Math.abs(diffDays) < 1) {
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    if (Math.abs(diffHours) < 1) return 'Just now';
    return rtf.format(diffHours, 'hour');
  }
  return rtf.format(diffDays, 'day');
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

function getActivityIcon(type: ActivityItem['type']) {
  switch (type) {
    case 'funded':
      return Zap;
    case 'completed':
      return CheckCircle2;
    case 'in_progress':
      return DollarSign;
    default:
      return Zap;
  }
}

function getActivityIconClass(type: ActivityItem['type']) {
  switch (type) {
    case 'funded':
      return 'bg-amber-500/10 text-amber-600';
    case 'completed':
      return 'bg-green-500/10 text-green-600';
    case 'in_progress':
      return 'bg-blue-500/10 text-blue-600';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function getActivityTitle(type: ActivityItem['type']) {
  switch (type) {
    case 'funded':
      return 'New bounty created';
    case 'completed':
      return 'Bounty completed';
    case 'in_progress':
      return 'Work in progress';
    default:
      return 'Activity';
  }
}

export function OrgActivity({ items }: OrgActivityProps) {
  if (items.length === 0) {
    return (
      <Empty className="border-0 py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="h-10 w-10 text-muted-foreground/30">
            <Globe strokeWidth={1.5} />
          </EmptyMedia>
          <EmptyTitle className="text-sm font-normal text-muted-foreground">
            No recent activity.
          </EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ItemGroup className="gap-0">
      {items.map((item, index) => {
        const Icon = getActivityIcon(item.type);
        const iconClass = getActivityIconClass(item.type);

        return (
          <Fragment key={`${item.type}-${item.id}`}>
            {index > 0 && <ItemSeparator />}
            <Link href={item.url} className="block">
              <Item className="py-3 cursor-pointer hover:bg-muted/30 transition-colors">
                <ItemMedia variant="icon" className={cn('rounded-full p-2', iconClass)}>
                  <Icon className="size-4" strokeWidth={2} />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle className="flex items-center justify-between">
                    <span className="font-medium text-sm">{getActivityTitle(item.type)}</span>
                    <span className="font-mono text-xs text-green-600 font-medium">
                      {formatCurrency(item.amount)}
                    </span>
                  </ItemTitle>
                  <ItemDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {item.title && (
                      <span className="truncate max-w-[300px]">{item.title}</span>
                    )}
                    {item.repoOwner && item.repoName && (
                      <span className="text-muted-foreground/60">
                        {item.repoOwner}/{item.repoName}
                      </span>
                    )}
                    {item.date && (
                      <span className="text-muted-foreground/60">
                        {formatRelativeTime(new Date(item.date))}
                      </span>
                    )}
                  </ItemDescription>
                </ItemContent>
              </Item>
            </Link>
          </Fragment>
        );
      })}
    </ItemGroup>
  );
}
