'use client';

import type { DashboardStats } from '@/db/queries/bounties';
import type { Bounty } from '@/lib/types';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClaimedTabContent } from './claimed-tab-content';
import { CompletedTabContent } from './completed-tab-content';
import { CreatedTabContent } from './created-tab-content';
import { DashboardFooterCTA } from './dashboard-footer-cta';
import { DashboardHeader } from './dashboard-header';
import { DashboardTabs } from './dashboard-tabs';
import { WatchingTabContent } from './watching-tab-content';

export type TabType = 'created' | 'claimed' | 'watching' | 'completed';

const VALID_TABS: TabType[] = ['created', 'claimed', 'watching', 'completed'];

export type SerializedSubmission = {
  id: string;
  bountyId: string;
  userId: string;
  githubUserId: string | null;
  githubPrId: string | null;
  githubPrNumber: number | null;
  githubPrUrl: string | null;
  githubPrTitle: string | null;
  status: string;
  submittedAt: string | null;
  funderApprovedAt: string | null;
  funderApprovedBy: string | null;
  ownerApprovedAt: string | null;
  ownerApprovedBy: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
  rejectionNote: string | null;
  prMergedAt: string | null;
  prClosedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreatedBountyItem = {
  bounty: Bounty;
  submissionCount: number;
  activeSubmissionCount: number;
};

export type ClaimedBountyItem = {
  submission: SerializedSubmission;
  bounty: Bounty;
};

export type CompletedBountyItem = {
  submission: SerializedSubmission;
  bounty: Bounty;
  payout: {
    id: string;
    amount: string;
    confirmedAt: string | null;
    txHash: string | null;
  } | null;
};

interface DashboardClientProps {
  stats: DashboardStats;
  created: CreatedBountyItem[];
  claimed: ClaimedBountyItem[];
  completed: CompletedBountyItem[];
  userName: string | null;
}

export function DashboardClient({
  stats,
  created,
  claimed,
  completed,
  userName,
}: DashboardClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Get active tab from URL, default to 'created'
  const tabParam = searchParams.get('tab');
  const activeTab: TabType = VALID_TABS.includes(tabParam as TabType)
    ? (tabParam as TabType)
    : 'created';

  const handleTabChange = (tab: TabType) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.push(`/dashboard?${params.toString()}`);
  };

  const counts = {
    created: created.length,
    claimed: claimed.length,
    watching: 0,
    completed: completed.length,
  };

  return (
    <div className="min-h-screen">
      {/* Header Section */}
      <section className="border-b border-border">
        <DashboardHeader userName={userName} stats={stats} />
      </section>

      {/* Tabs Section */}
      <section className="border-b border-border py-6">
        <div className="container">
          <DashboardTabs activeTab={activeTab} onTabChange={handleTabChange} counts={counts} />
        </div>
      </section>

      {/* Content Section */}
      <section className="py-8">
        <div className="container">
          {activeTab === 'created' && <CreatedTabContent bounties={created} />}
          {activeTab === 'claimed' && <ClaimedTabContent bounties={claimed} />}
          {activeTab === 'watching' && <WatchingTabContent />}
          {activeTab === 'completed' && <CompletedTabContent bounties={completed} />}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="border-t border-border bg-muted/30 py-12">
        <DashboardFooterCTA />
      </section>
    </div>
  );
}
