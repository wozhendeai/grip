import { UnifiedWorkflow } from './_components/home/unified-workflow';
import { Hero } from './_components/home/hero';
import { BountyCard } from '@/components/bounty/bounty-card';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getOpenBounties } from '@/db/queries/bounties';
import { getRepoSettingsCount } from '@/db/queries/repo-settings';
import type { Bounty } from '@/lib/types';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Home',
  description: 'Discover and fund GitHub bounties on GRIP',
};

export default async function HomePage() {
  // Fetch stats from database
  const [bountiesData, reposCount] = await Promise.all([
    getOpenBounties({ status: ['open', 'completed'], limit: 100 }),
    getRepoSettingsCount(),
  ]);

  const openBounties = bountiesData.filter((b) => b.bounty.status === 'open');
  const completedBounties = bountiesData.filter((b) => b.bounty.status === 'completed');
  const totalValue = openBounties.reduce((sum, b) => sum + Number(b.bounty.totalFunded), 0);
  const totalPaid = completedBounties.reduce((sum, b) => sum + Number(b.bounty.totalFunded), 0);

  // Transform featured bounties
  const featuredBounties: Bounty[] = openBounties
    .sort((a, b) => Number(b.bounty.totalFunded) - Number(a.bounty.totalFunded))
    .slice(0, 3)
    .map(({ bounty }) => ({
      id: bounty.id,
      network: bounty.network,
      githubRepoId: bounty.githubRepoId.toString(),
      githubOwner: bounty.githubOwner,
      githubRepo: bounty.githubRepo,
      githubFullName: bounty.githubFullName,
      githubIssueNumber: bounty.githubIssueNumber,
      githubIssueId: bounty.githubIssueId.toString(),
      githubIssueAuthorId: bounty.githubIssueAuthorId?.toString() ?? null,
      githubIssueUrl: `https://github.com/${bounty.githubFullName}/issues/${bounty.githubIssueNumber}`,
      title: bounty.title,
      body: bounty.body,
      labels: bounty.labels,
      totalFunded: bounty.totalFunded.toString(),
      tokenAddress: bounty.tokenAddress,
      primaryFunderId: bounty.primaryFunderId,
      status: bounty.status as Bounty['status'],
      approvedAt: bounty.approvedAt,
      ownerApprovedAt: bounty.ownerApprovedAt,
      paidAt: bounty.paidAt,
      cancelledAt: bounty.cancelledAt,
      createdAt: bounty.createdAt,
      updatedAt: bounty.updatedAt,
      project: {
        githubOwner: bounty.githubOwner,
        githubRepo: bounty.githubRepo,
        githubFullName: bounty.githubFullName,
      },
    }));

  return (
    <main className="min-h-screen">
      <Hero />

      <section className="border-b border-white/5 bg-card/50 backdrop-blur-sm">
        <div className="container py-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            <StatItem label="Open Bounties" value={openBounties.length.toString()} />
            <StatItem label="Total Value" value={`$${totalValue.toLocaleString()}`} highlight />
            <StatItem label="Paid Out" value={`$${totalPaid.toLocaleString()}`} />
            <StatItem label="Repos" value={reposCount.toString()} />
          </div>
        </div>
      </section>

      <UnifiedWorkflow />

      {/* Featured Bounties */}
      <section className="border-t border-border/50 py-24 bg-card/30">
        <div className="container">
          <div className="mb-12 flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Featured Bounties</h2>
              <p className="mt-2 text-lg text-muted-foreground">
                High-leverage opportunities for top-tier contributors.
              </p>
            </div>
            <Link
              href="/explore"
              className={cn(buttonVariants({ variant: 'outline' }), 'hidden sm:flex')}
            >
              View all bounties
            </Link>
          </div>

          {featuredBounties.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featuredBounties.map((bounty, index) => (
                <BountyCard key={bounty.id} bounty={bounty} index={index} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/50 bg-card/50 p-12 text-center">
              <p className="text-lg text-muted-foreground">No open bounties right now.</p>
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: 'link' }), 'mt-2 text-primary')}
              >
                Be the first to create one
              </Link>
            </div>
          )}

          <div className="mt-8 text-center sm:hidden">
            <Link href="/explore" className={buttonVariants({ variant: 'outline' })}>
              View all bounties
            </Link>
          </div>
        </div>
      </section>

      {/* Footer is handled by layout, but we ensure the bottom of page is clean */}
    </main>
  );
}

function StatItem({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="text-center md:text-left">
      <div
        className={`text-3xl font-bold tracking-tight ${highlight ? 'text-primary' : 'text-foreground'}`}
      >
        {value}
      </div>
      <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
}
