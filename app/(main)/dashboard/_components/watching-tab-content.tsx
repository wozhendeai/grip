import { DashboardEmptyState } from './dashboard-empty-state';

/**
 * Watching tab content - Placeholder for future feature
 * Shows empty state explaining the feature is coming soon
 */
export function WatchingTabContent() {
  return (
    <div role="tabpanel" id="watching-panel" aria-labelledby="watching-tab">
      <DashboardEmptyState variant="watching" />
    </div>
  );
}
