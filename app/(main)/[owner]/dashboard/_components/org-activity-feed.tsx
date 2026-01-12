import { cn } from '@/lib/utils';
import type { OrgActivityItem } from '@/db/queries/org-dashboard';

interface OrgActivityFeedProps {
  activities: OrgActivityItem[];
}

function getActivityColor(type: OrgActivityItem['type']) {
  switch (type) {
    case 'bounty_created':
      return 'bg-green-500';
    case 'payment':
      return 'bg-blue-500';
    case 'bounty_claimed':
      return 'bg-purple-500';
    case 'bounty_completed':
      return 'bg-amber-500';
  }
}

function formatTimestamp(timestamp: string): string {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function OrgActivityFeed({ activities }: OrgActivityFeedProps) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold px-1">Latest Activity</h3>

      {activities.length === 0 ? (
        <div className="rounded-md border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">No recent activity.</p>
        </div>
      ) : (
        <div className="rounded-md border bg-card divide-y">
          {activities.map((activity) => (
            <div key={activity.id} className="p-3 flex items-start gap-3">
              {/* Activity indicator */}
              <div
                className={cn('mt-1.5 size-2 rounded-full shrink-0', getActivityColor(activity.type))}
              />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{activity.title}</p>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatTimestamp(activity.timestamp)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                  {activity.description}
                  {activity.meta && (
                    <span className="text-primary ml-1">{activity.meta}</span>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
