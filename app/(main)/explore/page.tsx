import type { Metadata } from 'next';
import Link from 'next/link';

import { getAllBounties, type BountyFilters, type SortOption } from '@/db/queries/bounties';
import type { BountyStatus } from '@/lib/types';
import { BountyCard } from '@/components/bounty/bounty-card';
import { BountySort } from '@/components/bounty/bounty-sort';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Filter } from 'lucide-react';
import { FilterPopover } from './_components/filter-popover';

export const metadata: Metadata = {
  title: 'Explore Bounties',
  description: 'Browse and discover open bounties on GRIP.',
};

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Await searchParams (Next.js 15 requires this)
  const params = await searchParams;

  // Parse search params
  const statusParam = params.status;
  const status = Array.isArray(statusParam) ? statusParam : statusParam ? [statusParam] : ['open'];

  const labelParam = params.label;
  const labels = Array.isArray(labelParam) ? labelParam : labelParam ? [labelParam] : undefined;

  const filters: BountyFilters = {
    status: status as BountyStatus[],
    minAmount: params.min ? BigInt(params.min as string) : undefined,
    maxAmount: params.max ? BigInt(params.max as string) : undefined,
    labels: labels,
    limit: 100, // Reasonable limit
  };

  const sort = (params.sort as SortOption) || 'newest';

  const bountiesData = await getAllBounties({
    status: filters.status,
    sort,
    minAmount: filters.minAmount,
    maxAmount: filters.maxAmount,
    labels: filters.labels,
    limit: filters.limit,
  });

  const bounties = bountiesData.map(({ bounty }) => ({
    ...bounty,
    id: bounty.id,
    chainId: bounty.chainId,
    githubRepoId: bounty.githubRepoId.toString(),
    githubOwner: bounty.githubOwner,
    githubRepo: bounty.githubRepo,
    githubFullName: bounty.githubFullName,
    githubIssueNumber: bounty.githubIssueNumber,
    githubIssueId: bounty.githubIssueId.toString(),
    githubIssueAuthorId: bounty.githubIssueAuthorId?.toString() ?? null,
    githubIssueUrl: `https://github.com/${bounty.githubFullName}/issues/${bounty.githubIssueNumber}`,
    totalFunded: bounty.totalFunded.toString(),
    labels: bounty.labels,
    status: bounty.status as BountyStatus,
    project: {
      githubOwner: bounty.githubOwner,
      githubRepo: bounty.githubRepo,
      githubFullName: bounty.githubFullName,
    },
  }));

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="relative border-b border-border/40 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-50" />
        <div className="absolute right-0 top-0 h-96 w-96 translate-x-1/2 translate-y-[-20%] rounded-full bg-primary/10 blur-[100px]" />

        <div className="container relative py-16 sm:py-20 text-center sm:text-left">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
            Explore Bounties
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto sm:mx-0">
            Discover high-leverage opportunities. Fund issues, contribute code, and earn rewards
            on-chain.
          </p>
        </div>
      </div>

      <div className="container py-10">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-border/40 pb-6 mb-8">
          <div className="text-sm font-medium text-muted-foreground">
            Showing{' '}
            <span className="text-foreground">
              {bounties.length >= 100 ? '100+' : bounties.length}
            </span>{' '}
            {bounties.length === 1 ? 'bounty' : 'bounties'}
          </div>
          <div className="flex items-center gap-2">
            <FilterPopover currentStatus={status as BountyStatus[]} currentLabels={labels} />
            <BountySort />
          </div>
        </div>

        {/* Grid */}
        {bounties.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {bounties.map((bounty, index) => (
              <BountyCard key={bounty.id} bounty={bounty} index={index} />
            ))}
          </div>
        ) : (
          <Empty className="border-border/50 bg-card/50 py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="h-16 w-16 rounded-full bg-muted/50">
                <Filter className="h-8 w-8 text-muted-foreground" />
              </EmptyMedia>
              <EmptyTitle className="text-lg font-semibold mb-2">
                No bounties match your filters
              </EmptyTitle>
              <EmptyDescription className="text-muted-foreground mb-6 max-w-sm">
                Try adjusting your search criteria or clear filters to see all open bounties.
              </EmptyDescription>
              <Link href="/explore">
                <Button variant="outline">Clear all filters</Button>
              </Link>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </main>
  );
}
