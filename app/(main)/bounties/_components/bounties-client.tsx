'use client';

import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatCard } from '@/components/ui/stat-card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatTokenAmount } from '@/lib/tempo/format';
import type { Bounty } from '@/lib/types';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { BountyListItem } from './bounty-list-item';

/**
 * BountiesClient - Client component for interactive filtering/sorting
 *
 * Receives SSR data from parent page, handles filtering and sorting client-side.
 * No data fetching needed - all data provided as props.
 *
 * Design decisions:
 * - Stats cards row shows key metrics at a glance
 * - Open/Closed tabs for filtering (most common filter)
 * - Sort dropdown for ordering (amount, newest, oldest)
 * - List view (not grid) for higher information density
 */

type FilterTab = 'open' | 'closed';
type SortOption = 'amount' | 'newest' | 'oldest';

interface BountyStats {
  totalBounties: number;
  openBounties: number;
  completedBounties: number;
  amountOpen: string; // BigInt serialized as string
  amountPaid: string; // BigInt serialized as string
  reposWithBounties: number;
}

interface BountiesClientProps {
  initialBounties: Bounty[];
  stats: BountyStats;
}

export function BountiesClient({ initialBounties, stats }: BountiesClientProps) {
  const [filterTab, setFilterTab] = useState<FilterTab>('open');
  const [sortBy, setSortBy] = useState<SortOption>('amount');

  const filteredBounties = useMemo(() => {
    let filtered = initialBounties;

    // Filter by tab
    if (filterTab === 'open') {
      filtered = filtered.filter((b) => b.status === 'open');
    } else {
      filtered = filtered.filter((b) => b.status === 'completed');
    }

    // Sort
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'amount':
          // Compare BigInt amounts (stored as strings)
          return Number(BigInt(b.totalFunded) - BigInt(a.totalFunded));
        case 'oldest':
          return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
        default:
          return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
      }
    });
  }, [initialBounties, filterTab, sortBy]);

  const openCount = initialBounties.filter((b) => b.status === 'open').length;
  const closedCount = initialBounties.filter((b) => b.status === 'completed').length;

  return (
    <div className="min-h-screen">
      {/* Header Section */}
      <section className="border-b border-border">
        <div className="container py-12">
          <h1 className="mb-2 text-3xl font-bold md:text-4xl">Bounties</h1>
          <p className="text-muted-foreground">
            <Link
              href="https://docs.bountylane.dev/bounties"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Learn more about bounties here &rarr;
            </Link>
          </p>

          {/* Stats Cards Row */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Amount Paid Out"
              value={formatTokenAmount(stats.amountPaid)}
              info="Total value of completed bounties"
              valueClassName="text-success"
            />
            <StatCard
              label="Amount Open"
              value={formatTokenAmount(stats.amountOpen)}
              info="Total value of open bounties available to claim"
            />
            <StatCard
              label="Repos with Bounties"
              value={stats.reposWithBounties}
              info="Number of repositories with active bounty programs"
            />
            <StatCard
              label="Total Bounties"
              value={stats.totalBounties}
              info="Total number of bounties created"
            />
          </div>
        </div>
      </section>

      {/* Controls Section */}
      <section className="sticky top-16 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Left: Count + Tabs */}
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">
                {filteredBounties.length} {filteredBounties.length === 1 ? 'Bounty' : 'Bounties'}
              </span>

              <Tabs value={filterTab} onValueChange={(v) => setFilterTab(v as FilterTab)}>
                <TabsList>
                  <TabsTrigger value="open">Open ({openCount})</TabsTrigger>
                  <TabsTrigger value="closed">Closed ({closedCount})</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Right: Sort */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Sort:</span>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="amount">Amount</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </section>

      {/* Bounty List */}
      <section className="py-8">
        <div className="container">
          {filteredBounties.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>
                  {filterTab === 'open' ? 'No open bounties' : 'No closed bounties'}
                </EmptyTitle>
                <EmptyDescription>
                  {filterTab === 'open'
                    ? 'Check back later for new opportunities'
                    : 'Completed bounties will appear here'}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div>
              {filteredBounties.map((bounty, index) => (
                <BountyListItem key={bounty.id} bounty={bounty} index={index} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
