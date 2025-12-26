'use client';

import { TokenAmount } from '@/components/tempo/token-amount';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { bounties, payouts, repoSettings } from '@/db';
import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  Clock,
  Download,
  ExternalLink,
  Filter,
  LayoutGrid,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { CancelPendingPaymentButton } from './cancel-pending-payment-button';

/**
 * ActivityFeed - Simplified tabbed activity view for wallet page
 *
 * Design decision: Reduced from 6 tabs to 4 for cleaner UX.
 * Tabs:
 * - All: All transactions combined
 * - Earnings: Incoming bounty payments (contributor view)
 * - Withdrawals: Outgoing transfers to external addresses
 * - Deposits: Incoming transfers from external sources
 *
 * Removed tabs:
 * - Payments: Maintainer-specific, will have separate project management page
 * - Fundings: Project treasury, will have separate page
 * - Direct Transfers: Merged into Deposits/Withdrawals based on direction
 */

type ActivityType = 'all' | 'earnings' | 'sent' | 'withdrawals' | 'deposits';

interface ActivityCounts {
  all: number;
  earnings: number;
  sent: number;
  withdrawals: number;
  deposits: number;
}

interface EarningRecord {
  payout: typeof payouts.$inferSelect;
  bounty: typeof bounties.$inferSelect;
  repoSettings: typeof repoSettings.$inferSelect | null;
}

interface SentPaymentRecord {
  payout: typeof payouts.$inferSelect;
  recipient: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
}

interface PendingPaymentRecord {
  id: string;
  amount: string;
  tokenAddress: string;
  recipientGithubUsername: string;
  bountyId: string | null;
  submissionId: string | null;
  status: string;
  createdAt: string | null;
  claimExpiresAt: string | null;
  claimToken: string;
  bountyTitle: string | null;
  bountyGithubFullName: string | null;
}

interface ActivityFeedProps {
  earnings?: EarningRecord[];
  sentPayments?: SentPaymentRecord[];
  pendingPayments?: PendingPaymentRecord[];
}

const DEFAULT_COUNTS: ActivityCounts = {
  all: 0,
  earnings: 0,
  sent: 0,
  withdrawals: 0,
  deposits: 0,
};

const ACTIVITY_TABS: {
  value: ActivityType;
  label: string;
  emptyTitle: string;
  emptyDesc: string;
}[] = [
  {
    value: 'all',
    label: 'All',
    emptyTitle: 'No Activity',
    emptyDesc: 'No transactions found. Complete bounties or fund your wallet to see activity here.',
  },
  {
    value: 'earnings',
    label: 'Earnings',
    emptyTitle: 'No Earnings Yet',
    emptyDesc: 'Complete bounties to earn USDC. Your payments will appear here.',
  },
  {
    value: 'sent',
    label: 'Sent',
    emptyTitle: 'No Sent Payments',
    emptyDesc: "You haven't sent any payments yet. Send a payment to someone from their profile.",
  },
  {
    value: 'withdrawals',
    label: 'Withdrawals',
    emptyTitle: 'No Withdrawals',
    emptyDesc: "You haven't made any withdrawals yet.",
  },
  {
    value: 'deposits',
    label: 'Deposits',
    emptyTitle: 'No Deposits',
    emptyDesc: 'No deposits received. Fund your wallet to see deposits here.',
  },
];

export function ActivityFeed({
  earnings = [],
  sentPayments = [],
  pendingPayments = [],
}: ActivityFeedProps) {
  const [activeTab, setActiveTab] = useState<ActivityType>('all');

  // Calculate counts from actual data
  const counts: ActivityCounts = {
    all: earnings.length + sentPayments.length + pendingPayments.length,
    earnings: earnings.length,
    sent: sentPayments.length + pendingPayments.length,
    withdrawals: 0,
    deposits: 0,
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ActivityType)}>
        {/* Header with tabs and filter */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <TabsList className="bg-transparent p-0 h-auto gap-2">
            {ACTIVITY_TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="relative rounded-none border-b-2 border-transparent bg-transparent px-2 pb-2 pt-1 text-sm text-muted-foreground shadow-none transition-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                <span className="flex items-center gap-1.5">
                  <TabIcon type={tab.value} />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-secondary px-1.5 text-xs">
                    {counts[tab.value]}
                  </span>
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filter</span>
          </Button>
        </div>

        {/* All Tab */}
        <TabsContent value="all" className="m-0">
          {earnings.length > 0 || sentPayments.length > 0 || pendingPayments.length > 0 ? (
            <div className="divide-y divide-border">
              {/* Combine all activities and sort by date */}
              {[
                ...earnings.map((e) => ({
                  type: 'earning' as const,
                  data: e,
                  date: e.payout.confirmedAt ?? e.payout.createdAt,
                })),
                ...sentPayments.map((s) => ({
                  type: 'sent' as const,
                  data: s,
                  date: s.payout.confirmedAt ?? s.payout.createdAt,
                })),
                ...pendingPayments.map((p) => ({
                  type: 'pending' as const,
                  data: p,
                  date: p.createdAt,
                })),
              ]
                .sort((a, b) => {
                  const dateA = a.date ? new Date(a.date).getTime() : 0;
                  const dateB = b.date ? new Date(b.date).getTime() : 0;
                  return dateB - dateA; // Newest first
                })
                .map((item) => {
                  if (item.type === 'earning')
                    return (
                      <EarningItem key={`earning-${item.data.payout.id}`} record={item.data} />
                    );
                  if (item.type === 'sent')
                    return (
                      <SentPaymentItem key={`sent-${item.data.payout.id}`} record={item.data} />
                    );
                  return <PendingPaymentItem key={`pending-${item.data.id}`} payment={item.data} />;
                })}
            </div>
          ) : (
            <div className="p-6">
              <Empty className="border-0 bg-transparent py-12">
                <EmptyTitle>No Activity</EmptyTitle>
                <EmptyDescription>
                  No transactions found. Complete bounties or fund your wallet to see activity here.
                </EmptyDescription>
              </Empty>
            </div>
          )}
        </TabsContent>

        {/* Earnings Tab */}
        <TabsContent value="earnings" className="m-0">
          {earnings.length > 0 ? (
            <div className="divide-y divide-border">
              {earnings.map((record) => (
                <EarningItem key={record.payout.id} record={record} />
              ))}
            </div>
          ) : (
            <div className="p-6">
              <Empty className="border-0 bg-transparent py-12">
                <EmptyTitle>No Earnings Yet</EmptyTitle>
                <EmptyDescription>
                  Complete bounties to earn USDC. Your payments will appear here.
                </EmptyDescription>
              </Empty>
            </div>
          )}
        </TabsContent>

        {/* Sent Tab */}
        <TabsContent value="sent" className="m-0">
          {sentPayments.length > 0 || pendingPayments.length > 0 ? (
            <div className="divide-y divide-border">
              {/* Combine sent payments and pending payments, sort by date */}
              {[
                ...sentPayments.map((s) => ({
                  type: 'sent' as const,
                  data: s,
                  date: s.payout.confirmedAt ?? s.payout.createdAt,
                })),
                ...pendingPayments.map((p) => ({
                  type: 'pending' as const,
                  data: p,
                  date: p.createdAt,
                })),
              ]
                .sort((a, b) => {
                  const dateA = a.date ? new Date(a.date).getTime() : 0;
                  const dateB = b.date ? new Date(b.date).getTime() : 0;
                  return dateB - dateA;
                })
                .map((item) => {
                  if (item.type === 'sent')
                    return (
                      <SentPaymentItem key={`sent-${item.data.payout.id}`} record={item.data} />
                    );
                  return <PendingPaymentItem key={`pending-${item.data.id}`} payment={item.data} />;
                })}
            </div>
          ) : (
            <div className="p-6">
              <Empty className="border-0 bg-transparent py-12">
                <EmptyTitle>No Sent Payments</EmptyTitle>
                <EmptyDescription>
                  You haven&apos;t sent any payments yet. Send a payment to someone from their
                  profile.
                </EmptyDescription>
              </Empty>
            </div>
          )}
        </TabsContent>

        {/* Withdrawals Tab */}
        <TabsContent value="withdrawals" className="m-0">
          <div className="p-6">
            <Empty className="border-0 bg-transparent py-12">
              <EmptyTitle>No Withdrawals</EmptyTitle>
              <EmptyDescription>You haven&apos;t made any withdrawals yet.</EmptyDescription>
            </Empty>
          </div>
        </TabsContent>

        {/* Deposits Tab */}
        <TabsContent value="deposits" className="m-0">
          <div className="p-6">
            <Empty className="border-0 bg-transparent py-12">
              <EmptyTitle>No Deposits</EmptyTitle>
              <EmptyDescription>
                Deposit tracking coming soon. Use the Faucet button to request testnet tokens.
              </EmptyDescription>
            </Empty>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EarningItem({ record }: { record: EarningRecord }) {
  const { payout, bounty } = record;
  const timestamp = payout.confirmedAt ?? payout.createdAt;

  return (
    <div className="flex items-start gap-4 p-4 hover:bg-muted/50 transition-colors">
      {/* Icon */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/10">
        <ArrowDownWideNarrow className="h-5 w-5 text-success" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-medium truncate">{bounty.title}</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {bounty.githubFullName} • {payout.memoContributor ? `${payout.memoContributor} ` : ''}
              {payout.memoIssueNumber ? `#${payout.memoIssueNumber}` : ''}
              {payout.memoPrNumber ? ` PR#${payout.memoPrNumber}` : ''}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            <TokenAmount
              amount={payout.amount.toString()}
              symbol="USDC"
              className="font-semibold"
            />
            <Badge
              variant={payout.status === 'confirmed' ? 'default' : 'secondary'}
              className="text-xs"
            >
              {payout.status}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          {timestamp && (
            <span>
              {new Date(timestamp).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          )}
          {payout.txHash && (
            <Link
              href={`/tx/${payout.txHash}`}
              className="flex items-center gap-1 hover:text-primary transition-colors"
            >
              View transaction
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function SentPaymentItem({ record }: { record: SentPaymentRecord }) {
  const { payout, recipient } = record;
  const timestamp = payout.confirmedAt ?? payout.createdAt;

  return (
    <div className="flex items-start gap-4 p-4 hover:bg-muted/50 transition-colors">
      {/* Icon */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
        <ArrowUpWideNarrow className="h-5 w-5 text-destructive" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-medium truncate">Payment to @{recipient?.name ?? 'Unknown'}</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {payout.memoMessage && `"${payout.memoMessage}"`}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            <TokenAmount
              amount={payout.amount.toString()}
              symbol="USDC"
              className="font-semibold text-destructive"
            />
            <Badge
              variant={payout.status === 'confirmed' ? 'default' : 'secondary'}
              className="text-xs"
            >
              {payout.status}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          {timestamp && (
            <span>
              {new Date(timestamp).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          )}
          {payout.txHash && (
            <Link
              href={`/tx/${payout.txHash}`}
              className="flex items-center gap-1 hover:text-primary transition-colors"
            >
              View transaction
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function PendingPaymentItem({ payment }: { payment: PendingPaymentRecord }) {
  const createdDate = payment.createdAt
    ? new Date(payment.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  const expiresDate = payment.claimExpiresAt
    ? new Date(payment.claimExpiresAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  const context = payment.bountyTitle
    ? `${payment.bountyGithubFullName} • ${payment.bountyTitle}`
    : 'Direct payment';

  return (
    <div className="flex items-start gap-4 p-4 hover:bg-muted/50 transition-colors">
      {/* Amber icon for "pending" state */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-chart-4/10">
        <Clock className="h-5 w-5 text-chart-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-medium truncate">Payment to @{payment.recipientGithubUsername}</p>
            <p className="text-sm text-muted-foreground mt-0.5 truncate">{context}</p>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <TokenAmount amount={payment.amount} symbol="USDC" className="font-semibold" />
            <Badge variant="secondary" className="text-xs">
              Pending Claim
            </Badge>
            <CancelPendingPaymentButton paymentId={payment.id} />
          </div>
        </div>

        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          {createdDate && <span>Created: {createdDate}</span>}
          {expiresDate && <span>Expires: {expiresDate}</span>}
          <Link
            href={`/claim/${payment.claimToken}`}
            className="flex items-center gap-1 hover:text-primary transition-colors"
          >
            View claim link
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function TabIcon({ type }: { type: ActivityType }) {
  const iconClass = 'h-4 w-4';

  switch (type) {
    case 'all':
      return <LayoutGrid className={iconClass} />;
    case 'earnings':
      return <ArrowDownWideNarrow className={iconClass} />;
    case 'sent':
      return <ArrowUpWideNarrow className={iconClass} />;
    case 'withdrawals':
      return <Upload className={iconClass} />;
    case 'deposits':
      return <Download className={iconClass} />;
    default:
      return null;
  }
}
