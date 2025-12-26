import type { ClaimedBountyItem } from './dashboard-client';
import { DashboardBountyCard } from './dashboard-bounty-card';
import { DashboardEmptyState } from './dashboard-empty-state';

interface ClaimedTabContentProps {
  bounties: ClaimedBountyItem[];
}

/**
 * Claimed tab content - Shows bounties user has submitted work for
 * Only shows active submissions (pending, approved, merged) - not paid
 */
export function ClaimedTabContent({ bounties }: ClaimedTabContentProps) {
  if (bounties.length === 0) {
    return <DashboardEmptyState variant="claimed" />;
  }

  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      role="tabpanel"
      id="claimed-panel"
      aria-labelledby="claimed-tab"
    >
      {bounties.map((item) => (
        <DashboardBountyCard
          key={item.submission.id}
          bounty={item.bounty}
          variant="claimed"
          submission={item.submission}
        />
      ))}
    </div>
  );
}
