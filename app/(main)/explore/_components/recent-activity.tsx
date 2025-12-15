'use client';

import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { formatTimeAgo, skeletonItems } from '@/lib/utils';
import { Check, GitMerge, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * RecentActivity - Platform activity feed for explore page
 *
 * Shows recent events like bounties created, claimed, paid, etc.
 * Currently shows empty state as activity tracking is not yet implemented.
 */

type ActivityType = 'bounty_created' | 'bounty_claimed' | 'bounty_paid' | 'pr_merged';

interface ActivityEvent {
  id: string;
  type: ActivityType;
  description: string;
  amount?: number;
  repoName?: string;
  issueNumber?: number;
  timestamp: Date;
}

export function RecentActivity() {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch real activity when API is implemented
    // For now, simulate loading then show empty state
    const timer = setTimeout(() => {
      setActivities([]);
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="py-8">
      <div className="container">
        {/* Section Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold">Recent Activity</h2>
          <Link
            href="/activity"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            View all &rarr;
          </Link>
        </div>

        {/* Activity List */}
        <div className="rounded-lg border border-border bg-card">
          {isLoading ? (
            <div className="divide-y divide-border">
              {skeletonItems(5).map((id) => (
                <ActivityItemSkeleton key={id} />
              ))}
            </div>
          ) : activities.length === 0 ? (
            <Empty className="border-0 bg-transparent py-12">
              <EmptyHeader>
                <EmptyTitle>No recent activity</EmptyTitle>
                <EmptyDescription>
                  Bounty creations, claims, and payouts will appear here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="divide-y divide-border">
              {activities.map((activity) => (
                <ActivityItem key={activity.id} activity={activity} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ActivityItem({ activity }: { activity: ActivityEvent }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <ActivityIcon type={activity.type} />
      <div className="flex-1 min-w-0">
        <p className="text-sm">{activity.description}</p>
      </div>
      <span className="text-xs text-muted-foreground shrink-0">
        {formatTimeAgo(activity.timestamp)}
      </span>
    </div>
  );
}

function ActivityItemSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
      </div>
      <div className="h-3 w-16 rounded bg-muted animate-pulse" />
    </div>
  );
}

function ActivityIcon({ type }: { type: ActivityType }) {
  const baseClass = 'flex h-8 w-8 items-center justify-center rounded-full';
  const iconClass = 'h-4 w-4';

  switch (type) {
    case 'bounty_created':
      return (
        <div className={`${baseClass} bg-primary/10 text-primary`}>
          <Plus className={iconClass} />
        </div>
      );
    case 'bounty_claimed':
      return (
        <div className={`${baseClass} bg-warning/10 text-warning`}>
          <Users className={iconClass} />
        </div>
      );
    case 'bounty_paid':
      return (
        <div className={`${baseClass} bg-success/10 text-success`}>
          <Check className={iconClass} />
        </div>
      );
    case 'pr_merged':
      return (
        <div className={`${baseClass} bg-accent/50 text-accent-foreground`}>
          <GitMerge className={iconClass} />
        </div>
      );
    default:
      return null;
  }
}
