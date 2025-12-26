import {
  getBountiesCreatedByUser,
  getCompletedBountiesByUser,
  getUserActiveSubmissions,
  getUserDashboardStats,
} from '@/db/queries/bounties';
import { getSession } from '@/lib/auth/auth-server';
import type { Bounty } from '@/lib/types';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { DashboardClient } from './_components/dashboard-client';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: "Track bounties you've created, claimed, or are watching",
};

/**
 * Dashboard Page - Personal bounty hub
 *
 * Server component with SSR data fetching.
 * Requires authentication - redirects to login if not signed in.
 *
 * Tabs:
 * - Created: Bounties user funded (primaryFunderId)
 * - Claimed: Active submissions (pending/approved/merged)
 * - Watching: Placeholder for future feature
 * - Completed: Bounties where user was paid
 */
export default async function DashboardPage() {
  const session = await getSession();

  if (!session?.user) {
    redirect('/login?redirect=/dashboard');
  }

  const userId = session.user.id;

  // Fetch all data in parallel for performance
  const [stats, createdData, claimedData, completedData] = await Promise.all([
    getUserDashboardStats(userId),
    getBountiesCreatedByUser(userId),
    getUserActiveSubmissions(userId),
    getCompletedBountiesByUser(userId),
  ]);

  // Transform created bounties for client (serialize BigInt)
  const created = createdData.map((item) => ({
    bounty: transformBounty(item.bounty),
    submissionCount: item.submissionCount,
    activeSubmissionCount: item.activeSubmissionCount,
  }));

  // Transform claimed bounties for client
  const claimed = claimedData.map((item) => ({
    submission: transformSubmission(item.submission),
    bounty: transformBounty(item.bounty),
  }));

  // Transform completed bounties for client
  const completed = completedData.map((item) => ({
    submission: transformSubmission(item.submission),
    bounty: transformBounty(item.bounty),
    payout: item.payout
      ? {
          id: item.payout.id,
          amount: item.payout.amount.toString(),
          confirmedAt: item.payout.confirmedAt,
          txHash: item.payout.txHash,
        }
      : null,
  }));

  return (
    <DashboardClient
      stats={stats}
      created={created}
      claimed={claimed}
      completed={completed}
      userName={session.user.name}
    />
  );
}

/**
 * Transform bounty from DB format to client format
 * Serializes BigInt fields to strings for JSON compatibility
 */
function transformBounty(bounty: {
  id: string;
  network: string;
  repoSettingsId: bigint | null;
  githubRepoId: bigint;
  githubOwner: string;
  githubRepo: string;
  githubFullName: string;
  githubIssueNumber: number;
  githubIssueId: bigint;
  githubIssueAuthorId: bigint | null;
  title: string;
  body: string | null;
  labels: unknown;
  totalFunded: bigint;
  tokenAddress: string;
  primaryFunderId: string | null;
  organizationId: string | null;
  status: string;
  approvedAt: string | null;
  ownerApprovedAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}): Bounty {
  return {
    ...bounty,
    totalFunded: bounty.totalFunded.toString(),
    githubRepoId: bounty.githubRepoId.toString(),
    githubIssueId: bounty.githubIssueId.toString(),
    githubIssueAuthorId: bounty.githubIssueAuthorId?.toString() ?? null,
    status: bounty.status as Bounty['status'],
    labels: bounty.labels as Bounty['labels'],
    createdAt: bounty.createdAt ?? new Date().toISOString(),
    updatedAt: bounty.updatedAt ?? new Date().toISOString(),
    githubIssueUrl: `https://github.com/${bounty.githubFullName}/issues/${bounty.githubIssueNumber}`,
    project: {
      githubOwner: bounty.githubOwner,
      githubRepo: bounty.githubRepo,
      githubFullName: bounty.githubFullName,
    },
  };
}

/**
 * Transform submission from DB format to client format
 */
function transformSubmission(submission: {
  id: string;
  bountyId: string;
  userId: string;
  githubUserId: bigint | null;
  githubPrId: bigint | null;
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
  createdAt: string | null;
  updatedAt: string | null;
}) {
  return {
    ...submission,
    githubUserId: submission.githubUserId?.toString() ?? null,
    githubPrId: submission.githubPrId?.toString() ?? null,
    createdAt: submission.createdAt ?? new Date().toISOString(),
    updatedAt: submission.updatedAt ?? new Date().toISOString(),
  };
}
