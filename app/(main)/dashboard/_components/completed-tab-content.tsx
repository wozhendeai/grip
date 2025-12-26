import type { CompletedBountyItem } from './dashboard-client';
import { DashboardBountyCard } from './dashboard-bounty-card';
import { DashboardEmptyState } from './dashboard-empty-state';

interface CompletedTabContentProps {
  bounties: CompletedBountyItem[];
}

/**
 * Completed tab content - Shows bounties where user was paid
 */
export function CompletedTabContent({ bounties }: CompletedTabContentProps) {
  if (bounties.length === 0) {
    return <DashboardEmptyState variant="completed" />;
  }

  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      role="tabpanel"
      id="completed-panel"
      aria-labelledby="completed-tab"
    >
      {bounties.map((item) => (
        <DashboardBountyCard
          key={item.submission.id}
          bounty={item.bounty}
          variant="completed"
          submission={item.submission}
          payout={item.payout}
        />
      ))}
    </div>
  );
}
