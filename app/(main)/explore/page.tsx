import { getAllBounties } from '@/lib/db/queries/bounties';
import { getTopReposByBountyValue } from '@/lib/db/queries/repo-settings';
import { RecentActivity } from './_components/recent-activity';
import type { TopRepo } from './_components/repo-card';
import { TopRepos } from './_components/top-repos';

/**
 * Explore Page - Browse bounties and discover projects
 *
 * Server component: Fetches all data server-side for better SEO and performance.
 * No loading states needed - page is fully rendered on server.
 *
 * Design decisions:
 * - Stats header shows key metrics at a glance
 * - Top Repos section highlights active projects
 * - Recent Activity shows platform events
 * - Removed complex filter UI in favor of dedicated /bounties page
 */

export default async function ExplorePage() {
  // Fetch all data in parallel on the server
  const [openBountiesData, topReposData] = await Promise.all([
    getAllBounties({ status: 'open', limit: 100 }),
    getTopReposByBountyValue(6),
  ]);

  // Extract bounties from the { bounty, repoSettings } structure
  const openBounties = openBountiesData.map((r) => r.bounty);

  // Calculate stats (totalFunded is BigInt, sum as BigInt then convert to number for display)
  const totalValueBigInt = openBounties.reduce((sum, b) => sum + b.totalFunded, BigInt(0));
  const totalValue = Number(BigInt(totalValueBigInt) / BigInt(1000000)); // Convert from 6 decimals to whole number

  // Transform top repos data to match TopRepo interface
  const topRepos: TopRepo[] = topReposData.map((r) => ({
    id: r.githubRepoId.toString(),
    githubOwner: r.githubOwner,
    githubRepo: r.githubRepo,
    githubFullName: r.githubFullName,
    totalBountyValue: r.totalBountyValue,
    openBountyCount: r.openBountyCount,
  }));

  return (
    <div className="min-h-screen">
      {/* Header Section */}
      <section className="border-b border-border">
        <div className="container py-12">
          <h1 className="mb-2 text-3xl font-bold md:text-4xl">Explore Bounties</h1>
          <p className="max-w-lg text-muted-foreground">
            Browse open bounties across projects. Find work that matches your skills and get paid
            instantly when your PR merges.
          </p>

          {/* Stats Row - No loading state, SSR */}
          <div className="mt-6 flex flex-wrap gap-8">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{openBounties.length}</span>
              <span className="text-sm text-muted-foreground">Open Bounties</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">${totalValue.toLocaleString()}</span>
              <span className="text-sm text-muted-foreground">Available</span>
            </div>
          </div>
        </div>
      </section>

      {/* Top Repos Section */}
      <section className="py-8">
        <TopRepos repos={topRepos} />
      </section>

      {/* Recent Activity Section */}
      <RecentActivity />
    </div>
  );
}
