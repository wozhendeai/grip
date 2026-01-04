/**
 * Shared types for TPay (Promise Layer)
 *
 * Used by both API responses and frontend components.
 * Matches the API response format from /api endpoints.
 *
 * CRITICAL MENTAL MODEL:
 * This is NOT escrow. Funds never leave funder's wallet until payout.
 * bounty_funders.amount = promised amount, NOT deposited.
 *
 * IMPORTANT: All BigInt fields (amounts, GitHub IDs) are serialized as strings
 * for JSON compatibility. Use lib/tempo/format.ts for display formatting.
 */

/**
 * Repo Settings (formerly Project)
 *
 * Optional repo-level settings for verified owners.
 * Minimal table — just verification + require_owner_approval flag.
 */
export interface RepoSettings {
  githubRepoId: string; // BigInt serialized as string
  githubOwner: string;
  githubRepo: string;
  requireOwnerApproval: boolean;
  verifiedOwnerUserId: string | null;
  verifiedAt: string | null;
  webhookId: string | null; // BigInt serialized as string
  webhookSecret: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * Bounty Status
 *
 * Simplified lifecycle (removed in_progress, draft, etc.)
 */
export type BountyStatus =
  | 'open' // accepting work submissions
  | 'completed' // PR merged and paid
  | 'cancelled'; // all commitments withdrawn OR explicitly cancelled by primary funder

/**
 * Submission Status (formerly ClaimStatus)
 *
 * Status values for work submissions (PRs)
 */
export type SubmissionStatus =
  | 'pending' // PR submitted, awaiting funder review
  | 'approved' // Funder approved (and owner if required), awaiting merge
  | 'rejected' // Rejected by funder or owner
  | 'merged' // PR merged on GitHub (webhook event)
  | 'paid' // Payment transaction confirmed on-chain
  | 'expired'; // Bounty cancelled before approval

/**
 * Bounty Funder
 *
 * Represents a funding commitment (promise, NOT deposit)
 */
export interface BountyFunder {
  id: string;
  funderId: string;
  amount: string; // BigInt serialized as string (promised amount, funds stay in funder's wallet)
  tokenAddress: string;
  network: string;
  createdAt: string | null;
  withdrawnAt: string | null;
  funder: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

/**
 * Bounty Project (minimal repo info for display)
 */
export interface BountyProject {
  githubOwner: string;
  githubRepo: string;
  githubFullName: string;
}

/**
 * Bounty Author (issue author)
 */
export interface BountyAuthor {
  id: string;
  name: string | null;
  image: string | null;
}

/**
 * Bounty Submission (formerly BountyClaim)
 *
 * Work submission (PR) for a bounty
 */
export interface BountySubmission {
  id: string;
  userId: string;
  githubUserId: string | null; // BigInt serialized as string
  githubPrId: string | null; // BigInt serialized as string
  githubPrNumber: number | null;
  githubPrUrl: string | null;
  githubPrTitle: string | null;
  status: SubmissionStatus;

  // Approval tracking
  funderApprovedAt: string | null;
  funderApprovedBy: string | null;
  ownerApprovedAt: string | null;
  ownerApprovedBy: string | null;

  // Rejection tracking
  rejectedAt: string | null;
  rejectedBy: string | null;
  rejectionNote: string | null;

  // GitHub events
  prMergedAt: string | null;
  prClosedAt: string | null;

  // Timestamps
  submittedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;

  // Relations
  submitter: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

/**
 * GitHub Label (from issue labels JSONB)
 */
export interface GithubLabel {
  id: number;
  name: string;
  color: string;
  description?: string;
}

/**
 * Bounty
 *
 * Individual bounty on GitHub issue.
 * Can exist WITHOUT repo_settings (permissionless model).
 */
export interface Bounty {
  id: string;
  network: string;

  // GitHub issue info
  githubRepoId: string; // BigInt serialized as string
  githubOwner: string;
  githubRepo: string;
  githubFullName: string;
  githubIssueNumber: number;
  githubIssueId: string; // BigInt serialized as string
  githubIssueAuthorId: string | null; // BigInt serialized as string
  githubIssueUrl: string;

  // Issue metadata
  title: string;
  body: string | null;
  labels: GithubLabel[] | null;

  // Funding (pooled promise model)
  totalFunded: string | null; // BigInt serialized as string (null when hidden by repo settings)
  tokenAddress: string;
  primaryFunderId: string | null; // first funder (controls approval)

  // Bounty lifecycle
  status: BountyStatus;
  approvedAt: string | null;
  ownerApprovedAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;

  createdAt: string | null;
  updatedAt: string | null;

  // Relations
  project: BountyProject;
  author?: BountyAuthor;
  funders?: BountyFunder[];
  submissions?: BountySubmission[];
}

/**
 * User Submission (formerly UserClaim)
 *
 * Submission with bounty details for user profile page
 */
export interface UserSubmission {
  id: string;
  status: SubmissionStatus;
  githubPrNumber: number | null;
  githubPrUrl: string | null;
  githubPrTitle: string | null;
  submittedAt: string | null;
  funderApprovedAt: string | null;
  ownerApprovedAt: string | null;
  rejectedAt: string | null;
  rejectionNote: string | null;
  prMergedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  bounty: {
    id: string;
    network: string;
    title: string;
    totalFunded: string; // BigInt serialized as string
    tokenAddress: string;
    status: BountyStatus;
    githubIssueNumber: number;
    githubIssueUrl: string;
  };
  project: BountyProject;
}

/**
 * Notification Types
 *
 * Discriminated union ensures type-safe metadata access.
 * Each notification type has specific metadata fields.
 */
export type NotificationType =
  | 'pr_submitted' // renamed from claim types
  | 'submission_expiring' // renamed from claim_expiring
  | 'payment_received'
  | 'bounty_created_on_repo'
  | 'pr_approved'
  | 'pr_rejected'
  | 'submission_expired' // renamed from claim_expired
  | 'direct_payment_sent'
  | 'direct_payment_received'
  | 'custodial_payment_sent'
  | 'pending_payment_created'; // Pending payment awaiting claim

/**
 * Notification metadata - discriminated union by type
 *
 * TypeScript ensures correct metadata shape for each notification type.
 * Compile-time safety prevents accessing wrong fields.
 */
export type NotificationMetadata =
  | {
      type: 'pr_submitted';
      bountyId: string;
      bountyTitle: string;
      amount: string; // BigInt serialized as string
      tokenAddress: string;
      submitterName: string;
      repoFullName: string;
    }
  | {
      type: 'submission_expiring';
      bountyId: string;
      bountyTitle: string;
      expiresAt: string;
      daysRemaining: number;
      repoFullName: string;
    }
  | {
      type: 'payment_received';
      txHash: string;
      amount: string; // BigInt serialized as string
      tokenAddress: string;
      bountyTitle: string;
      repoFullName: string;
    }
  | {
      type: 'bounty_created_on_repo';
      bountyId: string;
      bountyTitle: string;
      amount: string; // BigInt serialized as string
      tokenAddress: string;
      repoFullName: string;
    }
  | {
      type: 'pr_approved';
      bountyId: string;
      bountyTitle: string;
      amount: string; // BigInt serialized as string
      tokenAddress: string;
      repoFullName: string;
    }
  | {
      type: 'pr_rejected';
      bountyId: string;
      bountyTitle: string;
      rejectionNote?: string;
      repoFullName: string;
    }
  | {
      type: 'submission_expired';
      bountyId: string;
      bountyTitle: string;
      repoFullName: string;
    }
  | {
      type: 'custodial_payment_sent';
      bountyTitle: string;
      amount: string; // BigInt serialized as string
      tokenAddress: string;
      githubUsername: string;
      claimUrl: string;
      txHash: string;
    }
  | {
      type: 'direct_payment_sent';
      recipientUsername: string;
      amount: string; // BigInt serialized as string
      message: string;
      txHash: string;
    }
  | {
      type: 'direct_payment_received';
      senderName: string;
      amount: string; // BigInt serialized as string
      message: string;
      txHash: string;
    }
  | {
      type: 'pending_payment_created';
      amount: string; // BigInt serialized as string
      tokenAddress: string;
      claimUrl: string;
      claimExpiresAt: string;
      funderName: string;
      bountyId?: string; // Optional: only for bounty payments
      bountyTitle?: string; // Optional: only for bounty payments
    };

/**
 * Notification interface
 *
 * Returned by notification queries. The metadata field is a discriminated union
 * that provides type-safe access to notification-specific data.
 */
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  linkUrl: string;
  readAt: string | null;
  metadata: NotificationMetadata;
  createdAt: string;
}

/**
 * Truncate an address for display: 0x1234...5678
 */
export function truncateAddress(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
