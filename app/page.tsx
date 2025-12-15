import { BountyCard } from '@/components/bounty/bounty-card';
import { Button } from '@/components/ui/button';
import { getOpenBounties } from '@/lib/db/queries/bounties';
import { getRepoSettingsCount } from '@/lib/db/queries/repo-settings';
import type { Bounty } from '@/lib/types';
import Link from 'next/link';

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
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="container py-24 md:py-32 lg:py-40">
          <div className="max-w-3xl">
            <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl">
              Fund open source,
              <br />
              <span className="text-muted-foreground">get paid instantly.</span>
            </h1>

            <p className="mb-8 max-w-xl text-lg text-muted-foreground md:text-xl">
              Create bounties on GitHub issues. Contributors submit, you approve, and collect — paid
              in seconds with passkey auth. No seed phrases. No gas fees.
            </p>

            <div className="flex flex-col gap-4 sm:flex-row">
              <Button size="lg" render={<Link href="/login">Start Funding</Link>} />
              <Button
                variant="outline"
                size="lg"
                render={<Link href="/explore">Explore Bounties</Link>}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-b border-border bg-card/50">
        <div className="container py-6">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            <StatItem label="Open Bounties" value={openBounties.length.toString()} />
            <StatItem label="Total Value" value={`$${totalValue.toLocaleString()}`} highlight />
            <StatItem label="Paid Out" value={`$${totalPaid.toLocaleString()}`} />
            <StatItem label="Repos" value={reposCount.toString()} />
          </div>
        </div>
      </section>

      {/* Featured Bounties */}
      <section className="py-16 md:py-24">
        <div className="container">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Featured Bounties</h2>
              <p className="mt-1 text-muted-foreground">
                High-value opportunities waiting for contributors
              </p>
            </div>
            <Button
              variant="ghost"
              className="hidden sm:flex"
              render={
                <Link href="/explore">
                  View all
                  <span className="ml-2">→</span>
                </Link>
              }
            />
          </div>

          {featuredBounties.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featuredBounties.map((bounty, index) => (
                <BountyCard key={bounty.id} bounty={bounty} index={index} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-12 text-center">
              <p className="text-muted-foreground">No bounties yet. Be the first to create one!</p>
              <Button className="mt-4" render={<Link href="/login">Create a Bounty</Link>} />
            </div>
          )}

          <div className="mt-8 text-center sm:hidden">
            <Button variant="outline" render={<Link href="/explore">View all bounties</Link>} />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-border py-16 md:py-24">
        <div className="container">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold md:text-3xl">How it works</h2>
            <p className="mt-2 text-muted-foreground">Three steps from issue to payout</p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <StepCard
              number="01"
              title="Fund"
              description="Anyone can fund GitHub issues. Set the amount, publish, and watch contributors submit their work."
            />
            <StepCard
              number="02"
              title="Build"
              description="Contributors submit PRs and link their work. Multiple submissions allowed - funder picks the winner."
            />
            <StepCard
              number="03"
              title="Collect"
              description="Funder approves the best submission. Payment happens on-chain with sub-second finality, zero gas fees."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border">
        <div className="container py-16 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold md:text-3xl">Ready to fund your next feature?</h2>
            <p className="mt-4 text-muted-foreground">
              Connect your GitHub, create your first bounty, and tap into a global network of open
              source contributors.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button size="lg" render={<Link href="/login">Get Started</Link>} />
              <Button
                variant="outline"
                size="lg"
                render={
                  <Link href="https://github.com" target="_blank">
                    View on GitHub
                  </Link>
                }
              />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>BountyLane</span>
              <span className="mx-2">·</span>
              <span>Built on Tempo</span>
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <a
                href="https://docs.bountylane.dev"
                className="hover:text-foreground transition-colors"
              >
                Docs
              </a>
              <a
                href="https://github.com/bountylane"
                className="hover:text-foreground transition-colors"
              >
                GitHub
              </a>
              <a
                href="https://discord.gg/bountylane"
                className="hover:text-foreground transition-colors"
              >
                Discord
              </a>
            </div>
          </div>
        </div>
      </footer>
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
      <div className={`text-2xl font-bold md:text-3xl ${highlight ? 'text-foreground' : ''}`}>
        {value}
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="relative rounded-lg border border-border bg-card p-6">
      <div className="mb-4 text-4xl font-bold text-muted-foreground/30">{number}</div>
      <h3 className="mb-2 text-lg font-bold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
