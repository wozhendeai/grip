import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import type {
  ClaimedBountyListItem,
  CompletedBountyListItem,
  CreatedBountyWithSubmissionCount,
} from '@/db/queries/bounties';
import { cn } from '@/lib/utils';
import { CheckCircle2, GitPullRequest, Wallet } from 'lucide-react';
import Link from 'next/link';

interface ActivityFeedProps {
  created: CreatedBountyWithSubmissionCount[];
  claimed: ClaimedBountyListItem[];
  completed: CompletedBountyListItem[];
}

function getRelativeTime(date: Date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export function ActivityFeed({ created, claimed, completed }: ActivityFeedProps) {
  // Normalize and merge activities
  const activities = [
    ...created.map((item) => ({
      id: `created-${item.bounty.id}`,
      type: 'created' as const,
      date: item.bounty.createdAt ? new Date(item.bounty.createdAt) : new Date(),
      text: (
        <span>
          You funded{' '}
          <span className="font-medium">
            {item.bounty.githubRepo} #{item.bounty.githubIssueNumber}
          </span>
        </span>
      ),
      meta: `${item.bounty.githubOwner}/${item.bounty.githubRepo}`,
      href: `/${item.bounty.githubOwner}/${item.bounty.githubRepo}/bounties/${item.bounty.id}`,
      amount: item.bounty.totalFunded,
    })),
    ...claimed.map((item) => ({
      id: `claimed-${item.submission.id}`,
      type: 'claimed' as const,
      date: item.submission.createdAt ? new Date(item.submission.createdAt) : new Date(),
      text: (
        <span>
          You claimed{' '}
          <span className="font-medium">
            {item.bounty.githubRepo} #{item.bounty.githubIssueNumber}
          </span>
        </span>
      ),
      meta: `${item.bounty.githubOwner}/${item.bounty.githubRepo}`,
      href: `/${item.bounty.githubOwner}/${item.bounty.githubRepo}/bounties/${item.bounty.id}`,
      amount: item.bounty.totalFunded,
    })),
    ...completed.map((item) => ({
      id: `paid-${item.bounty.id}`,
      type: 'paid' as const,
      date: new Date(item.payout?.confirmedAt ?? item.bounty.paidAt ?? new Date()),
      text: (
        <span>
          Bounty <span className="font-medium">#{item.bounty.githubIssueNumber}</span> completed
        </span>
      ),
      meta: `You earned $${Number(item.payout?.amount ?? item.bounty.totalFunded).toLocaleString()}`,
      href: `/${item.bounty.githubOwner}/${item.bounty.githubRepo}/bounties/${item.bounty.id}`,
      amount: item.payout?.amount ?? item.bounty.totalFunded,
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 10); // Show a few more if compact

  if (activities.length === 0) {
    return (
      <Card className="h-full border-border bg-card shadow-sm py-0 gap-0">
        <CardHeader className="border-b border-border bg-muted/40 py-3 px-4">
          <CardTitle className="text-base font-semibold">Activity Feed</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center p-4">
          <Empty className="border-0">
            <EmptyHeader>
              <EmptyTitle>No recent activity</EmptyTitle>
              <EmptyDescription>
                <Link href="/explore">Explore bounties</Link> to get started
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full border-border bg-card shadow-sm py-0 gap-0">
      <CardHeader className="border-b border-border bg-muted/40 py-3 px-4">
        <CardTitle className="text-base font-semibold">Activity Feed</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {activities.map((activity) => (
          <Link
            key={activity.id}
            href={activity.href}
            className="flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors border-b border-border/50 last:border-0 group"
          >
            <div
              className={cn(
                'mt-0.5 flex-shrink-0 text-muted-foreground group-hover:text-foreground transition-colors'
              )}
            >
              {activity.type === 'created' && <Wallet className="h-4 w-4" />}
              {activity.type === 'claimed' && <GitPullRequest className="h-4 w-4" />}
              {activity.type === 'paid' && <CheckCircle2 className="h-4 w-4 text-success" />}
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-sm text-foreground flex flex-wrap gap-1">{activity.text}</div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                <span>{activity.meta}</span>
                <span>·</span>
                <span>{getRelativeTime(activity.date)}</span>
              </div>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
