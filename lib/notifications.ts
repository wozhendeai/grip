import { createNotification } from '@/db/queries/notifications';
import type { NotificationMetadata } from '@/lib/types';

/**
 * Notification Service
 *
 * Centralized service for creating typed notifications.
 * Handles message generation, link formatting, and metadata packaging.
 *
 * Design Decision: Service layer over direct DB calls because:
 * - Type-safe notification creation (TypeScript enforces correct metadata)
 * - Consistent message formatting across all trigger points
 * - Single place to update notification logic
 * - Easier to add features (email, push, etc.) later
 *
 * Usage: Import and call functions from integration points
 * Example: notifyPrSubmitted({ funderId, bountyId, ... })
 */

/**
 * Create notification with type-safe metadata
 *
 * Generic type ensures metadata matches the notification type.
 * This is a private helper used by all public functions.
 */
async function create<T extends NotificationMetadata>(
  userId: string,
  metadata: T,
  title: string,
  message: string,
  linkUrl: string
) {
  return createNotification({
    userId,
    type: metadata.type,
    title,
    message,
    linkUrl,
    metadata,
  });
}

/**
 * PR submitted on your bounty
 *
 * Sent to: Bounty funder/project owner
 * Trigger: Webhook detects PR opened + linked to bounty issue
 * Icon: 🟢
 */
export async function notifyPrSubmitted(params: {
  funderId: string;
  bountyId: string;
  bountyTitle: string;
  amount: string; // BigInt serialized as string
  tokenAddress: string;
  submitterName: string;
  repoFullName: string;
  repoOwner: string;
  repoName: string;
}) {
  return create(
    params.funderId,
    {
      type: 'pr_submitted',
      bountyId: params.bountyId,
      bountyTitle: params.bountyTitle,
      amount: params.amount,
      tokenAddress: params.tokenAddress,
      submitterName: params.submitterName,
      repoFullName: params.repoFullName,
    },
    `${params.submitterName} submitted PR for your bounty`,
    `${params.repoFullName} · "${params.bountyTitle}"`,
    `/${params.repoOwner}/${params.repoName}/bounties/${params.bountyId}`
  );
}

/**
 * Claim expiring soon (2 days warning)
 *
 * Sent to: Claimant
 * Trigger: Daily cron job checking claims.expiresAt
 * Icon: 🟡
 */
export async function notifyClaimExpiring(params: {
  claimantId: string;
  bountyId: string;
  bountyTitle: string;
  expiresAt: string;
  daysRemaining: number;
  repoFullName: string;
  repoOwner: string;
  repoName: string;
}) {
  return create(
    params.claimantId,
    {
      type: 'submission_expiring',
      bountyId: params.bountyId,
      bountyTitle: params.bountyTitle,
      expiresAt: params.expiresAt,
      daysRemaining: params.daysRemaining,
      repoFullName: params.repoFullName,
    },
    `Your claim expires in ${params.daysRemaining} day${params.daysRemaining === 1 ? '' : 's'}`,
    `${params.repoFullName} · "${params.bountyTitle}"`,
    `/${params.repoOwner}/${params.repoName}/bounties/${params.bountyId}`
  );
}

/**
 * Payment received
 *
 * Sent to: Payment recipient
 * Trigger: Payout confirmed on-chain
 * Icon: 💰
 */
export async function notifyPaymentReceived(params: {
  recipientId: string;
  txHash: string;
  amount: string; // BigInt serialized as string
  tokenAddress: string;
  bountyTitle: string;
  repoFullName: string;
}) {
  // Format amount for display (assuming 6 decimals for USDC)
  const amountFormatted = (Number(BigInt(params.amount)) / 1_000_000).toFixed(2);

  return create(
    params.recipientId,
    {
      type: 'payment_received',
      txHash: params.txHash,
      amount: params.amount,
      tokenAddress: params.tokenAddress,
      bountyTitle: params.bountyTitle,
      repoFullName: params.repoFullName,
    },
    `You received $${amountFormatted}`,
    `${params.repoFullName} · "${params.bountyTitle}"`,
    `/tx/${params.txHash}`
  );
}

/**
 * New bounty created on your repo
 *
 * Sent to: Repo owner (if project claimed)
 * Trigger: Bounty published with projectId
 * Icon: 🆕
 */
export async function notifyBountyCreatedOnRepo(params: {
  ownerId: string;
  bountyId: string;
  bountyTitle: string;
  amount: string; // BigInt serialized as string
  tokenAddress: string;
  repoFullName: string;
  repoOwner: string;
  repoName: string;
}) {
  const amountFormatted = (Number(BigInt(params.amount)) / 1_000_000).toFixed(2);

  return create(
    params.ownerId,
    {
      type: 'bounty_created_on_repo',
      bountyId: params.bountyId,
      bountyTitle: params.bountyTitle,
      amount: params.amount,
      tokenAddress: params.tokenAddress,
      repoFullName: params.repoFullName,
    },
    'New bounty on your repo',
    `${params.repoFullName} · "${params.bountyTitle}" · $${amountFormatted}`,
    `/${params.repoOwner}/${params.repoName}/bounties/${params.bountyId}`
  );
}

/**
 * Your PR approved
 *
 * Sent to: Claimant
 * Trigger: Funder approves claim
 * Icon: ✅
 */
export async function notifyPrApproved(params: {
  claimantId: string;
  bountyId: string;
  bountyTitle: string;
  amount: string; // BigInt serialized as string
  tokenAddress: string;
  repoFullName: string;
  repoOwner: string;
  repoName: string;
}) {
  const amountFormatted = (Number(BigInt(params.amount)) / 1_000_000).toFixed(2);

  return create(
    params.claimantId,
    {
      type: 'pr_approved',
      bountyId: params.bountyId,
      bountyTitle: params.bountyTitle,
      amount: params.amount,
      tokenAddress: params.tokenAddress,
      repoFullName: params.repoFullName,
    },
    `Bounty approved - $${amountFormatted} incoming!`,
    `${params.repoFullName} · "${params.bountyTitle}"`,
    `/${params.repoOwner}/${params.repoName}/bounties/${params.bountyId}`
  );
}

/**
 * Your PR rejected
 *
 * Sent to: Claimant
 * Trigger: Funder rejects claim
 * Icon: ❌
 */
export async function notifyPrRejected(params: {
  claimantId: string;
  bountyId: string;
  bountyTitle: string;
  rejectionNote?: string;
  repoFullName: string;
  repoOwner: string;
  repoName: string;
}) {
  return create(
    params.claimantId,
    {
      type: 'pr_rejected',
      bountyId: params.bountyId,
      bountyTitle: params.bountyTitle,
      rejectionNote: params.rejectionNote,
      repoFullName: params.repoFullName,
    },
    'Bounty rejected',
    `${params.repoFullName} · "${params.bountyTitle}"`,
    `/${params.repoOwner}/${params.repoName}/bounties/${params.bountyId}`
  );
}

/**
 * Your claim expired
 *
 * Sent to: Claimant
 * Trigger: Daily cron job expires stale claims
 * Icon: ⏰
 */
export async function notifyClaimExpired(params: {
  claimantId: string;
  bountyId: string;
  bountyTitle: string;
  repoFullName: string;
  repoOwner: string;
  repoName: string;
}) {
  return create(
    params.claimantId,
    {
      type: 'submission_expired',
      bountyId: params.bountyId,
      bountyTitle: params.bountyTitle,
      repoFullName: params.repoFullName,
    },
    'Your claim expired',
    `${params.repoFullName} · "${params.bountyTitle}"`,
    `/${params.repoOwner}/${params.repoName}/bounties/${params.bountyId}`
  );
}

/**
 * Payment sent to custodial wallet
 *
 * Sent to: Funder
 * Trigger: Bounty approved, payment sent to Turnkey custodial wallet for contributor without account
 * Icon: 🔐
 */
export async function notifyCustodialPaymentSent(params: {
  funderId: string;
  bountyTitle: string;
  amount: string; // BigInt serialized as string
  tokenAddress: string;
  githubUsername: string;
  claimUrl: string;
  txHash: string;
}) {
  const amountFormatted = (Number(BigInt(params.amount)) / 1_000_000).toFixed(2);

  return create(
    params.funderId,
    {
      type: 'custodial_payment_sent',
      bountyTitle: params.bountyTitle,
      amount: params.amount,
      tokenAddress: params.tokenAddress,
      githubUsername: params.githubUsername,
      claimUrl: params.claimUrl,
      txHash: params.txHash,
    },
    'Payment sent to secure wallet',
    `$${amountFormatted} sent for @${params.githubUsername}. They can claim when ready.`,
    `/tx/${params.txHash}`
  );
}

/**
 * Direct payment sent
 *
 * Sent to: Payment sender
 * Trigger: Direct payment transaction confirmed
 * Icon: 💸
 */
export async function notifyDirectPaymentSent(params: {
  senderId: string;
  recipientUsername: string;
  amount: string; // BigInt serialized as string
  message: string;
  txHash: string;
}) {
  const amountFormatted = (Number(BigInt(params.amount)) / 1_000_000).toFixed(2);

  return create(
    params.senderId,
    {
      type: 'direct_payment_sent',
      recipientUsername: params.recipientUsername,
      amount: params.amount,
      message: params.message,
      txHash: params.txHash,
    },
    `Payment sent to @${params.recipientUsername}`,
    `$${amountFormatted} • "${params.message}"`,
    `/tx/${params.txHash}`
  );
}

/**
 * Direct payment received
 *
 * Sent to: Payment recipient
 * Trigger: Direct payment transaction confirmed
 * Icon: 💰
 */
export async function notifyDirectPaymentReceived(params: {
  recipientId: string;
  senderName: string;
  amount: string; // BigInt serialized as string
  message: string;
  txHash: string;
}) {
  const amountFormatted = (Number(BigInt(params.amount)) / 1_000_000).toFixed(2);

  return create(
    params.recipientId,
    {
      type: 'direct_payment_received',
      senderName: params.senderName,
      amount: params.amount,
      message: params.message,
      txHash: params.txHash,
    },
    `You received $${amountFormatted} from ${params.senderName}`,
    `"${params.message}"`,
    `/tx/${params.txHash}`
  );
}
