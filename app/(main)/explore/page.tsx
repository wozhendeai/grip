import { getAllBounties } from '@/db/queries/bounties';
import { getTopReposByBountyValue } from '@/db/queries/repo-settings';
import type { Bounty } from '@/lib/types';
import type { Metadata } from 'next';
import { ExploreClient } from './_components/explore-client';
import type { TopRepo } from './_components/top-repos';

export const metadata: Metadata = {
  title: 'Explore Bounties',
  description: 'Browse open bounties across GitHub repositories',
};

/**
 * Explore Page - Browse bounties and discover projects
 *
 * Server component: Fetches all data server-side for better SEO and performance.
 * No loading states needed - page is fully rendered on server.
 *
 * Design decisions:
 * - Hybrid SSR + client pattern (like /bounties page)
 * - Server fetches data, client handles filtering
 * - Filter pills for language, amount, and tags
 * - Bounty feed with description previews
 */

export default async function ExplorePage() {
  const [openBountiesData, topReposData] = await Promise.all([
    getAllBounties({ status: 'open', limit: 100 }),
    getTopReposByBountyValue(6),
  ]);

  const openBounties = openBountiesData.map((r) => r.bounty);

  const totalValueBigInt = openBounties.reduce((sum, b) => sum + b.totalFunded, BigInt(0));
  const totalValue = Number(BigInt(totalValueBigInt) / BigInt(1000000));

  const bounties: Bounty[] = openBounties.map((bounty) => ({
    ...bounty,
    totalFunded: bounty.totalFunded.toString(),
    githubRepoId: bounty.githubRepoId.toString(),
    githubIssueId: bounty.githubIssueId.toString(),
    githubIssueAuthorId: bounty.githubIssueAuthorId?.toString() ?? null,
    githubIssueUrl: `https://github.com/${bounty.githubFullName}/issues/${bounty.githubIssueNumber}`,
    labels: bounty.labels as Bounty['labels'],
    project: {
      githubOwner: bounty.githubOwner,
      githubRepo: bounty.githubRepo,
      githubFullName: bounty.githubFullName,
    },
  }));

  const topRepos: TopRepo[] = topReposData.map((r) => ({
    id: r.githubRepoId.toString(),
    githubOwner: r.githubOwner,
    githubRepo: r.githubRepo,
    githubFullName: r.githubFullName,
    totalBountyValue: r.totalBountyValue,
    openBountyCount: r.openBountyCount,
  }));

  const stats = {
    totalValue,
    openCount: bounties.length,
  };

  return <ExploreClient bounties={bounties} topRepos={topRepos} stats={stats} />;
}
