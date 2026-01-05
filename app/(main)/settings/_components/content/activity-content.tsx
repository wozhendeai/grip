'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '@/components/ui/item';
import { StatCard } from '@/components/ui/stat-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { CreditCard, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { formatUnits } from 'viem';

function formatUSDC(amount: string | bigint): string {
  const value = typeof amount === 'string' ? BigInt(amount) : amount;
  const formatted = formatUnits(value, 6);
  return `$${Number(formatted).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface ActivityStats {
  earned: { total: string; count: number };
  pending: { total: string; count: number };
  created: { total: string; count: number };
  claimed: { count: number };
}

export interface FundedBounty {
  bounty: {
    id: string;
    title: string;
    status: string;
    totalFunded: bigint;
    githubOwner: string;
    githubRepo: string;
  };
  repoSettings: {
    githubOwner: string;
    githubRepo: string;
  } | null;
  submissionCount: number;
}

export interface Contribution {
  bounty: {
    id: string;
    title: string;
    totalFunded: bigint;
    githubOwner: string;
    githubRepo: string;
  };
  repoSettings: {
    githubOwner: string;
    githubRepo: string;
  } | null;
  submission: {
    status: string;
    githubPrTitle: string | null;
  };
}

export interface ActivityContentProps {
  stats: ActivityStats;
  bounties: FundedBounty[];
  contributions: Contribution[];
  isModal?: boolean;
}

type ActivityTab = 'overview' | 'funded' | 'contributions';

export function ActivityContent({
  stats,
  bounties,
  contributions,
  isModal = false,
}: ActivityContentProps) {
  const [activeTab, setActiveTab] = useState<ActivityTab>('overview');

  return (
    <div className={cn('space-y-4', !isModal && 'max-w-4xl')}>
      {!isModal && (
        <div>
          <h1 className="text-2xl font-bold">Activity</h1>
          <p className="text-muted-foreground">Your bounty activity on GRIP</p>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActivityTab)}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="funded">Funded</TabsTrigger>
          <TabsTrigger value="contributions">Contributions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <OverviewTab stats={stats} isModal={isModal} />
        </TabsContent>

        <TabsContent value="funded" className="pt-4">
          <FundedTab bounties={bounties} isModal={isModal} />
        </TabsContent>

        <TabsContent value="contributions" className="pt-4">
          <ContributionsTab contributions={contributions} isModal={isModal} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab({ stats, isModal }: { stats: ActivityStats; isModal: boolean }) {
  return (
    <div className={cn('grid gap-4', isModal ? 'grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4')}>
      <StatCard
        label="Total Earned"
        value={formatUSDC(stats.earned.total)}
        info={`${stats.earned.count} bounties completed`}
      />
      <StatCard
        label="Pending Payouts"
        value={formatUSDC(stats.pending.total)}
        info={`${stats.pending.count} awaiting payment`}
      />
      <StatCard
        label="Bounties Created"
        value={formatUSDC(stats.created.total)}
        info={`${stats.created.count} bounties funded`}
      />
      <StatCard
        label="Bounties Claimed"
        value={stats.claimed.count.toString()}
        info="Total submissions made"
      />
    </div>
  );
}

function FundedTab({ bounties, isModal }: { bounties: FundedBounty[]; isModal: boolean }) {
  if (bounties.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <Empty>
            <EmptyMedia variant="icon">
              <CreditCard />
            </EmptyMedia>
            <EmptyTitle>No Bounties Created</EmptyTitle>
            <EmptyDescription>
              You haven&apos;t created any bounties yet.{' '}
              <Link href="/explore" className="text-primary hover:underline">
                Explore bounties
              </Link>
            </EmptyDescription>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <ItemGroup>
      {bounties.map(({ bounty, repoSettings, submissionCount }) => (
        <Item
          key={bounty.id}
          variant="outline"
          render={
            <Link href={`/${bounty.githubOwner}/${bounty.githubRepo}/bounties/${bounty.id}`} />
          }
        >
          <ItemContent>
            <ItemTitle>
              {bounty.title}
              <Badge
                variant={bounty.status === 'open' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {bounty.status}
              </Badge>
            </ItemTitle>
            <ItemDescription>
              {repoSettings?.githubOwner}/{repoSettings?.githubRepo} · {submissionCount} submission
              {submissionCount !== 1 ? 's' : ''}
            </ItemDescription>
          </ItemContent>
          <ItemContent className="items-end">
            <span className="font-bold">{formatUSDC(bounty.totalFunded)}</span>
            <span className="text-xs text-muted-foreground">USDC</span>
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  );
}

function ContributionsTab({
  contributions,
  isModal,
}: {
  contributions: Contribution[];
  isModal: boolean;
}) {
  if (contributions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <Empty>
            <EmptyMedia variant="icon">
              <TrendingUp />
            </EmptyMedia>
            <EmptyTitle>No Contributions Yet</EmptyTitle>
            <EmptyDescription>
              Complete bounties to see your contributions here.{' '}
              <Link href="/explore" className="text-primary hover:underline">
                Find bounties to work on
              </Link>
            </EmptyDescription>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <ItemGroup>
      {contributions.map(({ bounty, repoSettings, submission }) => (
        <Item
          key={bounty.id}
          variant="outline"
          render={
            <Link href={`/${bounty.githubOwner}/${bounty.githubRepo}/bounties/${bounty.id}`} />
          }
        >
          <ItemContent>
            <ItemTitle>
              {bounty.title}
              <Badge
                variant={submission.status === 'paid' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {submission.status}
              </Badge>
            </ItemTitle>
            <ItemDescription>
              {repoSettings?.githubOwner}/{repoSettings?.githubRepo}
              {submission.githubPrTitle && ` · ${submission.githubPrTitle}`}
            </ItemDescription>
          </ItemContent>
          <ItemContent className="items-end">
            <span className="font-bold text-success">{formatUSDC(bounty.totalFunded)}</span>
            <span className="text-xs text-muted-foreground">earned</span>
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  );
}
