import type { CreatedBountyItem } from './dashboard-client';
import { DashboardBountyCard } from './dashboard-bounty-card';
import { DashboardEmptyState } from './dashboard-empty-state';

interface CreatedTabContentProps {
  bounties: CreatedBountyItem[];
}

/**
 * Created tab content - Shows bounties user has created (primaryFunderId)
 */
export function CreatedTabContent({ bounties }: CreatedTabContentProps) {
  if (bounties.length === 0) {
    return <DashboardEmptyState variant="created" />;
  }

  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      role="tabpanel"
      id="created-panel"
      aria-labelledby="created-tab"
    >
      {bounties.map((item) => (
        <DashboardBountyCard
          key={item.bounty.id}
          bounty={item.bounty}
          variant="created"
          submissionCount={item.submissionCount}
          activeSubmissionCount={item.activeSubmissionCount}
        />
      ))}
    </div>
  );
}
