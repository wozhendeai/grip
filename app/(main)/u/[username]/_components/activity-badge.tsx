import { Badge } from '@/components/ui/badge';
import type { GitHubActivity } from '@/lib/github';

interface ActivityBadgeProps {
  activity: GitHubActivity;
}

/**
 * ActivityBadge - Shows GitHub user activity status
 *
 * Displays different badge styles based on recent contribution activity:
 * - Active (< 7 days): Green dot + "Active" badge
 * - Recent (7-30 days): Yellow dot + "Recently Active" badge
 * - Inactive (> 30 days or no activity): No badge shown
 *
 * Used for credibility assessment - helps funders identify active contributors.
 */
export function ActivityBadge({ activity }: ActivityBadgeProps) {
  if (activity.activityLevel === 'active') {
    return (
      <Badge variant="default" className="gap-1.5">
        <span className="h-2 w-2 rounded-full bg-success" />
        Active
      </Badge>
    );
  }

  if (activity.activityLevel === 'recent') {
    return (
      <Badge variant="secondary" className="gap-1.5">
        <span className="h-2 w-2 rounded-full bg-chart-4" />
        Recently Active
      </Badge>
    );
  }

  // Inactive - no badge shown (avoid highlighting inactive users)
  return null;
}
