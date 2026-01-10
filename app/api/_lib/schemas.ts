import { z } from 'zod';

// Common patterns
const hexAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid address');
const hexHash = z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid hash');

// Bounty action schemas
export const bountyApproveSchema = z.object({
  submissionId: z.string().optional(),
  note: z.string().optional(),
  useAccessKey: z.boolean().default(true),
});

export const bountyRejectSchema = z.object({
  submissionId: z.string().optional(),
  note: z.string().min(1, 'Rejection reason is required'),
});

export const bountyPublishSchema = z.object({}).optional();

export const bountySubmitSchema = z.object({
  githubPrNumber: z.number().int().positive(),
  githubPrUrl: z.string().url(),
  githubPrTitle: z.string().optional(),
  githubPrId: z.union([z.string(), z.number()]).optional(),
  githubUserId: z.union([z.string(), z.number()]).optional(),
});

// Consolidated bounty action schema with discriminated union (all actions)
export const bountyActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve'), ...bountyApproveSchema.shape }),
  z.object({ action: z.literal('reject'), ...bountyRejectSchema.shape }),
  z.object({ action: z.literal('publish') }),
  z.object({ action: z.literal('submit'), ...bountySubmitSchema.shape }),
]);

export type BountyAction = z.infer<typeof bountyActionSchema>;

// PATCH schema for bounty mutations (approve/reject/publish only - not submit)
export const bountyPatchActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve'), ...bountyApproveSchema.shape }),
  z.object({ action: z.literal('reject'), ...bountyRejectSchema.shape }),
  z.object({ action: z.literal('publish') }),
]);

export type BountyPatchAction = z.infer<typeof bountyPatchActionSchema>;

// Direct payment schema
export const directPaymentSchema = z.object({
  recipientUsername: z.string().min(1),
  amount: z.number().positive(),
  tokenAddress: hexAddress,
  message: z.string().min(1).max(32, 'Message too long (max 32 bytes UTF-8)'),
  useAccessKey: z.boolean().default(true),
});

export type DirectPayment = z.infer<typeof directPaymentSchema>;

// Batch payout schemas
export const batchConfirmSchema = z.object({
  payoutIds: z.array(z.string()).min(1),
  txHash: hexHash,
});

export const batchMarkConfirmedSchema = z.object({
  payoutIds: z.array(z.string()).min(1),
  txHash: hexHash,
  blockNumber: z.union([z.string(), z.number()]),
});

// Consolidated batch action schema
export const batchPayoutActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('confirm'), ...batchConfirmSchema.shape }),
  z.object({ action: z.literal('mark-confirmed'), ...batchMarkConfirmedSchema.shape }),
]);

export type BatchPayoutAction = z.infer<typeof batchPayoutActionSchema>;

// Bounty creation schema
export const createBountySchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  githubIssueNumber: z.number().int().positive(),
  amount: z.number().positive(),
  tokenAddress: hexAddress,
  publish: z.boolean().optional(),
});

export type CreateBounty = z.infer<typeof createBountySchema>;

// Single payout confirmation schema
export const payoutActionSchema = z.object({
  action: z.literal('confirm'),
  txHash: hexHash,
  status: z.enum(['success', 'reverted']).optional(),
  blockNumber: z.union([z.string(), z.number()]).optional(),
});

export type PayoutAction = z.infer<typeof payoutActionSchema>;

// Notification schemas
export const readNotificationSchema = z.object({
  notificationId: z.string().optional(),
});

// Repo settings schemas
export const createRepoSettingsSchema = z.object({
  githubRepoId: z.union([z.string(), z.number()]),
  githubOwner: z.string().min(1),
  githubRepo: z.string().min(1),
});

export const updateRepoSettingsSchema = z.object({
  contributorEligibility: z.enum(['anyone', 'collaborators']).optional(),
  autoPayEnabled: z.boolean().optional(),
  webhookEnabled: z.boolean().optional(),
});

// Organization schemas
export const createAccessKeySchema = z.object({
  teamMemberUserId: z.string().min(1),
  spendingLimits: z.array(
    z.object({
      tokenAddress: hexAddress,
      dailyLimit: z.union([z.string(), z.number()]),
      transactionLimit: z.union([z.string(), z.number()]),
    })
  ),
  authorizationSignature: z.string().min(1),
  authorizationHash: z.string().optional(),
});

export type CreateAccessKey = z.infer<typeof createAccessKeySchema>;
