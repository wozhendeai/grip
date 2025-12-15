import { getAllBounties, getBountyStats } from '@/lib/db/queries/bounties';
import type { Bounty } from '@/lib/types';
import { BountiesClient } from './_components/bounties-client';

/**
 * Bounties Page - Server component with SSR data
 *
 * Hybrid pattern:
 * - Fetches all data server-side for better SEO and initial load performance
 * - Passes data to client component for interactive filtering/sorting
 * - No loading states needed - page is fully rendered on server
 *
 * Design decisions:
 * - Stats cards row shows key metrics at a glance
 * - Open/Closed tabs for filtering (most common filter)
 * - Sort dropdown for ordering (amount, newest, oldest)
 * - List view (not grid) for higher information density
 */

export default async function BountiesPage() {
  // Fetch all data in parallel on the server
  const [stats, openBountiesData, completedBountiesData] = await Promise.all([
    getBountyStats(),
    getAllBounties({ status: 'open', limit: 100 }),
    getAllBounties({ status: 'completed', limit: 100 }),
  ]);

  // Transform to Bounty[] format for the client component
  const openBounties: Bounty[] = openBountiesData.map(({ bounty, repoSettings }) => ({
    ...bounty,
    // Serialize BigInt fields to strings
    totalFunded: bounty.totalFunded.toString(),
    githubRepoId: bounty.githubRepoId.toString(),
    githubIssueId: bounty.githubIssueId.toString(),
    githubIssueAuthorId: bounty.githubIssueAuthorId?.toString() ?? null,
    status: bounty.status as Bounty['status'],
    labels: bounty.labels as unknown as Bounty['labels'],
    githubIssueUrl: `https://github.com/${bounty.githubFullName}/issues/${bounty.githubIssueNumber}`,
    project: {
      githubOwner: bounty.githubOwner,
      githubRepo: bounty.githubRepo,
      githubFullName: bounty.githubFullName,
    },
  }));

  const completedBounties: Bounty[] = completedBountiesData.map(({ bounty, repoSettings }) => ({
    ...bounty,
    // Serialize BigInt fields to strings
    totalFunded: bounty.totalFunded.toString(),
    githubRepoId: bounty.githubRepoId.toString(),
    githubIssueId: bounty.githubIssueId.toString(),
    githubIssueAuthorId: bounty.githubIssueAuthorId?.toString() ?? null,
    status: bounty.status as Bounty['status'],
    labels: bounty.labels as unknown as Bounty['labels'],
    githubIssueUrl: `https://github.com/${bounty.githubFullName}/issues/${bounty.githubIssueNumber}`,
    project: {
      githubOwner: bounty.githubOwner,
      githubRepo: bounty.githubRepo,
      githubFullName: bounty.githubFullName,
    },
  }));

  const allBounties = [...openBounties, ...completedBounties];

  return <BountiesClient initialBounties={allBounties} stats={stats} />;
}
