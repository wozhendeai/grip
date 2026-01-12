'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import type { ActivityFeedItem } from '@/db/queries/dashboard';
import { cn } from '@/lib/utils';
import { CheckCircle2, GitPullRequest, Wallet } from 'lucide-react';
import Link from 'next/link';

type ActivityFeedProps = {
  activities: ActivityFeedItem[];
};

function getRelativeTime(dateStr: string | null) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

function getActivityDisplay(activity: ActivityFeedItem) {
  const { eventType, bounty, payout, metadata } = activity;

  switch (eventType) {
    case 'bounty_funded':
      return {
        icon: <Wallet className="h-4 w-4" />,
        iconColor: 'text-blue-500',
        title: bounty ? `Funded issue #${bounty.githubIssueNumber}` : 'Funded bounty',
        description: bounty?.title ?? '',
        meta: metadata?.amount ? `$${(Number(metadata.amount) / 1_000_000).toFixed(0)}` : undefined,
      };
    case 'submission_created':
      return {
        icon: <GitPullRequest className="h-4 w-4" />,
        iconColor: 'text-yellow-500',
        title: bounty ? `Claimed issue #${bounty.githubIssueNumber}` : 'Claimed bounty',
        description: bounty?.title ?? '',
        meta: bounty?.githubFullName,
      };
    case 'payout_sent':
      return {
        icon: <CheckCircle2 className="h-4 w-4" />,
        iconColor: 'text-green-500',
        title: 'Received payment',
        description: payout?.txHash ? `From ${payout.txHash.slice(0, 8)}...${payout.txHash.slice(-6)}` : '',
        meta: payout?.amount ? `$${(Number(payout.amount) / 1_000_000).toFixed(2)}` : undefined,
      };
    default:
      return {
        icon: <Wallet className="h-4 w-4" />,
        iconColor: 'text-muted-foreground',
        title: eventType.replace(/_/g, ' '),
        description: '',
        meta: undefined,
      };
  }
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <section>
        <h3 className="text-sm font-semibold px-1 mb-3">Latest Activity</h3>
        <Card className="py-0">
          <CardContent className="flex-1 flex items-center justify-center p-4">
            <Empty className="border-0">
              <EmptyHeader>
                <EmptyTitle>No recent activity</EmptyTitle>
                <EmptyDescription>
                  <Link href="/explore" className="text-primary hover:underline">
                    Explore bounties
                  </Link>{' '}
                  to get started
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section>
      <h3 className="text-sm font-semibold px-1 mb-3">Latest Activity</h3>
      <Card className="py-0">
        <CardContent className="p-0">
          {activities.map((activity) => {
            const display = getActivityDisplay(activity);
            return (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-4 border-b border-border/50 last:border-0"
              >
                <div
                  className={cn(
                    'mt-0.5 size-6 rounded-full flex items-center justify-center',
                    display.iconColor
                  )}
                >
                  {display.icon}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{display.title}</p>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {getRelativeTime(activity.createdAt)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                    <span className="truncate">{display.description}</span>
                    {display.meta && (
                      <span className="font-medium">{display.meta}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}
