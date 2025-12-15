import { isNull, sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { passkey, user } from './auth';
import type { AccessKeyLimits, ActivityMetadata, GithubLabel, NotificationMetadata } from './types';

/**
 * Business tables for TPay (Promise Layer)
 *
 * CRITICAL MENTAL MODEL:
 * This is NOT escrow. Funds never leave funder's wallet until payout.
 * - "Funded bounty" = funder made a public commitment (promise)
 * - bounty_funders.amount = promised amount, NOT deposited
 * - Payout = funder signs tx, sends directly to contributor
 *
 * We're a coordination layer, not custody. Like tinygrad's spreadsheet — tracking who promised what.
 *
 * Tables:
 * - tokens: TIP-20 token allowlist
 * - repo_settings: Optional repo-level settings for verified owners (MINIMAL)
 * - bounties: Individual bounties on GitHub issues (permissionless)
 * - bounty_funders: Funding commitments (promises, NOT deposits)
 * - submissions: Work submissions (PRs) for bounties
 * - payouts: On-chain payment records
 * - activity_log: Event audit trail
 * - notifications: User in-app notifications
 * - access_keys: Backend signing authorization for automated payouts
 *
 * DELETED TABLES (from old schema):
 * - projects → renamed to repo_settings (with changed PK)
 * - project_members → DELETED (YAGNI)
 * - claims → renamed to submissions
 * - payout_batches → DELETED (individual payouts only)
 * - user_stats → DELETED (compute on read)
 *
 * IMPORTANT: All timestamp columns use mode: 'string' to return ISO 8601 strings
 */

// ============================================================================
// PRIMITIVES - Column type helpers
// ============================================================================

/**
 * TIP-20 token amounts (uint256 with 6 decimals)
 *
 * Postgres numeric(78,0) stores full uint256 range.
 * Drizzle mode: "bigint" returns JavaScript BigInt.
 *
 * App layer must:
 * - Use .toString() for JSON serialization
 * - Parse with BigInt() constructor
 * - Format for display: amount / 1_000_000n
 */
const u256 = (name: string) => numeric(name, { precision: 78, scale: 0 }).$type<bigint>();

/**
 * External IDs that may exceed 2^53
 *
 * Used for:
 * - GitHub IDs (repo, issue, PR, user)
 * - Block numbers
 * - Unix timestamps (u64 expiry)
 *
 * Postgres bigint stores int64 range.
 * Drizzle mode: "bigint" returns JavaScript BigInt.
 */
const i64 = (name: string) => bigint(name, { mode: 'bigint' });

// ============================================================================
// ENUMS - Const arrays for type safety
// ============================================================================

export const tempoNetworks = ['testnet', 'mainnet'] as const;
export type TempoNetwork = (typeof tempoNetworks)[number];

export const bountyStatuses = ['open', 'completed', 'cancelled'] as const;
export type BountyStatus = (typeof bountyStatuses)[number];

export const submissionStatuses = [
  'pending',
  'approved',
  'rejected',
  'merged',
  'paid',
  'expired',
] as const;
export type SubmissionStatus = (typeof submissionStatuses)[number];

export const payoutStatuses = ['pending', 'confirmed', 'failed'] as const;
export type PayoutStatus = (typeof payoutStatuses)[number];

export const paymentTypes = ['bounty', 'direct'] as const;
export type PaymentType = (typeof paymentTypes)[number];

export const custodialWalletStatuses = ['pending', 'claimed', 'expired'] as const;
export type CustodialWalletStatus = (typeof custodialWalletStatuses)[number];

export const accessKeyStatuses = ['active', 'revoked', 'expired'] as const;
export type AccessKeyStatus = (typeof accessKeyStatuses)[number];

export const activityActions = [
  'bounty_created',
  'bounty_funded',
  'submission_created',
  'submission_approved',
  'payout_sent',
  'repo_claimed',
  'access_key_created',
  'access_key_revoked',
] as const;
export type ActivityAction = (typeof activityActions)[number];

// ============================================================================
// ENUMS - Postgres ENUMs
// ============================================================================

/**
 * Access Key Type Enum
 *
 * Tempo Access Key types for backend authorization.
 * BountyLane uses secp256k1 for backend signing (Turnkey-managed keys).
 */
export const accessKeyTypeEnum = pgEnum('access_key_type', ['secp256k1', 'p256', 'webauthn']);

/**
 * Tokens table
 *
 * Allowlist of supported TIP-20 tokens per network.
 * Each token exists on one network (testnet or mainnet).
 */
export const tokens = pgTable(
  'tokens',
  {
    address: varchar('address', { length: 42 }).notNull(),
    network: varchar('network', { length: 10, enum: tempoNetworks }).notNull(),
    symbol: varchar('symbol', { length: 10 }).notNull(),
    name: text('name').notNull(),
    decimals: integer('decimals').notNull().default(6),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.address, table.network] }),
    uniqueSymbol: unique().on(table.network, table.symbol),
    idxTokensNetworkActive: index('idx_tokens_network_active').on(table.network, table.isActive),
    chkTokensDecimals6: sql`CHECK (${table.decimals} = 6)`,
  })
);

/**
 * Repo Settings table
 *
 * Optional repo-level settings for verified owners.
 * Minimal table — just verification + require_owner_approval flag.
 *
 * IMPORTANT: github_repo_id is PRIMARY KEY (not UUID)
 *
 * Repo verification flow:
 * 1. User logs in with GitHub OAuth
 * 2. User navigates to /{owner}/{repo}/settings
 * 3. App queries GitHub API: GET /repos/{owner}/{repo} with user's OAuth token
 * 4. If permissions.admin === true, allow user to enable require_owner_approval
 * 5. Create repo_settings row with verified_owner_user_id = user.id
 */
export const repoSettings = pgTable(
  'repo_settings',
  {
    githubRepoId: i64('github_repo_id').primaryKey(),
    githubOwner: varchar('github_owner', { length: 39 }).notNull(),
    githubRepo: varchar('github_repo', { length: 100 }).notNull(),

    // Repo owner verification
    requireOwnerApproval: boolean('require_owner_approval').notNull().default(false),
    verifiedOwnerUserId: text('verified_owner_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    verifiedAt: timestamp('verified_at', { mode: 'string' }),

    // GitHub webhook (optional)
    webhookId: i64('webhook_id'),
    webhookSecret: text('webhook_secret'),

    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'string' })
      .defaultNow()
      .$onUpdate(() => new Date().toISOString()),
  },
  (table) => ({
    idxRepoSettingsOwner: index('idx_repo_settings_owner').on(table.verifiedOwnerUserId),
    idxRepoSettingsName: index('idx_repo_settings_name').on(table.githubOwner, table.githubRepo),
  })
);

/**
 * Bounties table
 *
 * Individual bounties on GitHub issues.
 * Can exist WITHOUT repo_settings (permissionless model).
 *
 * Status values:
 * - open: accepting work submissions
 * - completed: PR merged and paid
 * - cancelled: all commitments withdrawn OR explicitly cancelled by primary funder
 *
 * Primary funder = first funder by created_at who hasn't withdrawn (cached for perf)
 */
export const bounties = pgTable(
  'bounties',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Network (testnet/mainnet)
    network: varchar('network', { length: 10, enum: tempoNetworks }).notNull(),

    // Optional FK to repo_settings (only if repo owner verified)
    repoSettingsId: i64('repo_settings_id').references(() => repoSettings.githubRepoId, {
      onDelete: 'set null',
    }),

    // GitHub issue info (canonical references)
    githubRepoId: i64('github_repo_id').notNull(),
    githubOwner: varchar('github_owner', { length: 39 }).notNull(),
    githubRepo: varchar('github_repo', { length: 100 }).notNull(),
    githubFullName: varchar('github_full_name', { length: 140 }).notNull(),
    githubIssueNumber: integer('github_issue_number').notNull(),
    githubIssueId: i64('github_issue_id').notNull(),
    githubIssueAuthorId: i64('github_issue_author_id'),

    // Issue metadata (cached from GitHub)
    title: varchar('title', { length: 500 }).notNull(),
    body: text('body'),
    labels: jsonb('labels').$type<GithubLabel[]>().notNull().default([]),

    // Funding (pooled promise model)
    totalFunded: u256('total_funded').notNull().default(sql`0`),
    tokenAddress: varchar('token_address', { length: 42 }).notNull(),
    primaryFunderId: text('primary_funder_id').references(() => user.id),

    // Bounty lifecycle
    status: varchar('status', { length: 20, enum: bountyStatuses }).notNull().default('open'),

    // Completion tracking
    approvedAt: timestamp('approved_at', { mode: 'string' }),
    ownerApprovedAt: timestamp('owner_approved_at', { mode: 'string' }),
    paidAt: timestamp('paid_at', { mode: 'string' }),
    cancelledAt: timestamp('cancelled_at', { mode: 'string' }),

    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'string' })
      .defaultNow()
      .$onUpdate(() => new Date().toISOString()),
  },
  (table) => ({
    fkToken: foreignKey({
      columns: [table.tokenAddress, table.network],
      foreignColumns: [tokens.address, tokens.network],
    }),
    idxBountiesNetworkStatus: index('idx_bounties_network_status').on(table.network, table.status),
    idxBountiesNetworkRepo: index('idx_bounties_network_repo').on(
      table.network,
      table.githubRepoId
    ),
    idxBountiesPrimaryFunder: index('idx_bounties_primary_funder').on(table.primaryFunderId),
    idxBountiesRepoSettings: index('idx_bounties_repo_settings').on(table.repoSettingsId),
    uniqueBountyIssue: unique('idx_bounties_unique_issue').on(table.network, table.githubIssueId),
  })
);

/**
 * Bounty Funders table (NEW)
 *
 * Tracks funding commitments (promises, NOT deposits).
 * Multiple users can promise funds for a single bounty.
 *
 * IMPORTANT: amount is promised amount — funds stay in funder's wallet until payout.
 *
 * Primary funder determination:
 * SELECT funder_id FROM bounty_funders
 * WHERE bounty_id = $1 AND withdrawn_at IS NULL
 * ORDER BY created_at ASC
 * LIMIT 1;
 *
 * Business logic (enforced in application):
 * - When funding commitment added → update bounties.total_funded
 * - If first funder → set bounties.primary_funder_id
 * - If primary funder withdraws → promote next funder, update bounties.primary_funder_id
 * - If all funders withdraw → set bounties.status = 'cancelled', primary_funder_id = NULL
 */
export const bountyFunders = pgTable(
  'bounty_funders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bountyId: uuid('bounty_id')
      .notNull()
      .references(() => bounties.id, { onDelete: 'cascade' }),
    funderId: text('funder_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    // Promised amount (NOT deposited — funds stay in funder's wallet)
    amount: u256('amount').notNull(),
    tokenAddress: varchar('token_address', { length: 42 }).notNull(),
    network: varchar('network', { length: 10, enum: tempoNetworks }).notNull(),

    // Commitment lifecycle
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
    withdrawnAt: timestamp('withdrawn_at', { mode: 'string' }),
  },
  (table) => ({
    uniqueBountyFunder: unique().on(table.bountyId, table.funderId),
    fkToken: foreignKey({
      columns: [table.tokenAddress, table.network],
      foreignColumns: [tokens.address, tokens.network],
    }),
    idxBountyFundersBounty: index('idx_bounty_funders_bounty').on(table.bountyId),
    idxBountyFundersFunder: index('idx_bounty_funders_funder').on(table.funderId),
    idxBountyFundersNetwork: index('idx_bounty_funders_network').on(table.network),
  })
);

/**
 * Submissions table (renamed from claims)
 *
 * Work submissions (PRs) for bounties.
 * Multiple people can submit work on same bounty (race condition).
 * First merged PR wins.
 *
 * Status values:
 * - pending: PR submitted, awaiting funder review
 * - approved: Funder approved (and owner if required), awaiting merge
 * - rejected: Rejected by funder or owner
 * - merged: PR merged on GitHub (webhook event)
 * - paid: Payment transaction confirmed on-chain
 * - expired: Bounty cancelled before approval
 *
 * Approval flow:
 * 1. Contributor submits PR → status = 'pending'
 * 2. Primary funder approves → funder_approved_at = NOW()
 * 3. IF repo_settings.require_owner_approval = true:
 *    - Wait for owner approval → owner_approved_at = NOW()
 * 4. Both approvals done → status = 'approved'
 * 5. PR merges (GitHub webhook) → status = 'merged'
 * 6. Funder signs payout tx → status = 'paid', create payout record
 */
export const submissions = pgTable(
  'submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bountyId: uuid('bounty_id')
      .notNull()
      .references(() => bounties.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    // Canonical GitHub references
    githubUserId: i64('github_user_id'),
    githubPrId: i64('github_pr_id'),
    githubPrNumber: integer('github_pr_number'),
    githubPrUrl: text('github_pr_url'),
    githubPrTitle: text('github_pr_title'),

    // Submission lifecycle
    status: varchar('status', { length: 20, enum: submissionStatuses })
      .notNull()
      .default('pending'),

    // Approval tracking
    funderApprovedAt: timestamp('funder_approved_at', { mode: 'string' }),
    funderApprovedBy: text('funder_approved_by').references(() => user.id),
    ownerApprovedAt: timestamp('owner_approved_at', { mode: 'string' }),
    ownerApprovedBy: text('owner_approved_by').references(() => user.id),

    // Rejection tracking
    rejectedAt: timestamp('rejected_at', { mode: 'string' }),
    rejectedBy: text('rejected_by').references(() => user.id),
    rejectionNote: text('rejection_note'),

    // GitHub events (from webhooks)
    prMergedAt: timestamp('pr_merged_at', { mode: 'string' }),
    prClosedAt: timestamp('pr_closed_at', { mode: 'string' }),

    // Timestamps
    submittedAt: timestamp('submitted_at', { mode: 'string' }).defaultNow(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'string' })
      .defaultNow()
      .$onUpdate(() => new Date().toISOString()),
  },
  (table) => ({
    idxSubmissionsBounty: index('idx_submissions_bounty').on(table.bountyId),
    idxSubmissionsUser: index('idx_submissions_user').on(table.userId),
    idxSubmissionsStatus: index('idx_submissions_status').on(table.status),
    // Unique constraint on github_pr_id WHERE github_pr_id IS NOT NULL
    // Multiple submissions can have NULL github_pr_id, but actual PR IDs must be unique
    uniqueSubmissionPr: unique('idx_submissions_unique_pr').on(table.githubPrId),
  })
);

/**
 * Payouts table
 *
 * On-chain payment records.
 * Supports two payment types:
 * - 'bounty': Payment for completed bounty work (has bountyId + submissionId)
 * - 'direct': Direct payment between users (bountyId and submissionId are null)
 */
export const payouts = pgTable(
  'payouts',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Network (testnet/mainnet)
    network: varchar('network', { length: 10, enum: tempoNetworks }).notNull(),

    // Payment type discriminator
    paymentType: varchar('payment_type', { length: 20, enum: paymentTypes })
      .notNull()
      .default('bounty'),

    // References (nullable for direct payments)
    submissionId: uuid('submission_id').references(() => submissions.id),
    bountyId: uuid('bounty_id').references(() => bounties.id),
    repoSettingsId: i64('repo_settings_id').references(() => repoSettings.githubRepoId),

    // Parties involved
    payerUserId: text('payer_user_id')
      .notNull()
      .references(() => user.id),
    recipientUserId: text('recipient_user_id')
      .notNull()
      .references(() => user.id),
    recipientPasskeyId: text('recipient_passkey_id').references(() => passkey.id),
    recipientAddress: varchar('recipient_address', { length: 42 }),

    // Payment details
    amount: u256('amount').notNull(),
    tokenAddress: varchar('token_address', { length: 42 }).notNull(),

    // Blockchain details
    txHash: varchar('tx_hash', { length: 66 }),
    blockNumber: i64('block_number'),
    confirmedAt: timestamp('confirmed_at', { mode: 'string' }),

    // Memo (on-chain metadata)
    // For bounty payments: structured memo with issue/PR numbers
    memoIssueNumber: integer('memo_issue_number'),
    memoPrNumber: integer('memo_pr_number'),
    memoContributor: varchar('memo_contributor', { length: 39 }),
    memoBytes32: varchar('memo_bytes32', { length: 66 }),

    // For direct payments: user-provided message (max 32 bytes)
    memoMessage: text('memo_message'),

    // Work receipt (verifiable proof of work)
    workReceiptHash: varchar('work_receipt_hash', { length: 66 }),
    workReceiptLocator: varchar('work_receipt_locator', { length: 255 }),

    // Custodial wallet tracking (for payments to contributors without wallets)
    custodialWalletId: uuid('custodial_wallet_id'),
    isCustodial: boolean('is_custodial').default(false).notNull(),

    // Payout status
    status: varchar('status', { length: 20, enum: payoutStatuses }).default('pending'),
    errorMessage: text('error_message'),

    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'string' })
      .defaultNow()
      .$onUpdate(() => new Date().toISOString()),
  },
  (table) => ({
    fkToken: foreignKey({
      columns: [table.tokenAddress, table.network],
      foreignColumns: [tokens.address, tokens.network],
    }),
    idxPayoutsNetworkUser: index('idx_payouts_network_user').on(
      table.network,
      table.recipientUserId
    ),
    idxPayoutsNetworkStatus: index('idx_payouts_network_status').on(table.network, table.status),
    idxPayoutsSubmission: index('idx_payouts_submission').on(table.submissionId),
    idxPayoutsTxHash: index('idx_payouts_tx_hash').on(table.txHash),
    idxPayoutsCustodial: index('idx_payouts_custodial').on(table.custodialWalletId),
    // Indexes for direct payment queries
    idxPayoutsPaymentType: index('idx_payouts_payment_type').on(
      table.network,
      table.paymentType,
      table.recipientUserId
    ),
    idxPayoutsSender: index('idx_payouts_sender').on(table.network, table.payerUserId),
    // CHECK constraints for payment type discriminator unions
    chkPayoutsTypeShape: sql`CHECK ((${table.paymentType} = 'bounty' AND ${table.bountyId} IS NOT NULL AND ${table.submissionId} IS NOT NULL) OR (${table.paymentType} = 'direct' AND ${table.bountyId} IS NULL AND ${table.submissionId} IS NULL))`,
    chkPayoutsCustodialShape: sql`CHECK ((${table.isCustodial} = true AND ${table.custodialWalletId} IS NOT NULL) OR (${table.isCustodial} = false AND ${table.custodialWalletId} IS NULL))`,
  })
);

/**
 * Custodial Wallets table
 *
 * Turnkey-managed wallets for contributors who don't have BountyLane accounts yet.
 * When a funder approves a bounty for a contributor without a wallet, we:
 * 1. Create a Turnkey wallet for them (identified by GitHub user ID)
 * 2. Send payment immediately to that wallet
 * 3. Store claim token for later retrieval
 * 4. When contributor signs up, they claim funds and transfer to their passkey wallet
 */
export const custodialWallets = pgTable(
  'custodial_wallets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    network: varchar('network', { length: 10, enum: tempoNetworks }).notNull(),

    // GitHub identity (for matching when user signs up)
    githubUserId: i64('github_user_id').notNull(),
    githubUsername: varchar('github_username', { length: 39 }).notNull(),

    // Turnkey wallet details
    turnkeyWalletId: varchar('turnkey_wallet_id', { length: 255 }).notNull().unique(),
    turnkeyAccountId: varchar('turnkey_account_id', { length: 255 }).notNull(),
    address: varchar('address', { length: 42 }).notNull(),

    // Claim flow (secure token + expiration)
    claimToken: varchar('claim_token', { length: 64 }).notNull().unique(),
    claimExpiresAt: timestamp('claim_expires_at', { mode: 'string' }).notNull(),
    claimedAt: timestamp('claimed_at', { mode: 'string' }),

    // User linkage (set when claimed)
    userId: text('user_id').references(() => user.id),
    transferredToPasskeyId: text('transferred_to_passkey_id').references(() => passkey.id),
    transferTxHash: varchar('transfer_tx_hash', { length: 66 }),

    // Status tracking
    // 'pending' - Wallet created, awaiting claim
    // 'claimed' - Funds transferred to user's passkey wallet
    // 'expired' - Claim period expired (checked lazily, no cron)
    status: varchar('status', { length: 20, enum: custodialWalletStatuses })
      .default('pending')
      .notNull(),

    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'string' })
      .defaultNow()
      .$onUpdate(() => new Date().toISOString()),
  },
  (table) => ({
    idxCustodialWalletsGithubUser: index('idx_custodial_wallets_github_user').on(
      table.network,
      table.githubUserId
    ),
    idxCustodialWalletsClaimToken: index('idx_custodial_wallets_claim_token').on(table.claimToken),
    idxCustodialWalletsStatus: index('idx_custodial_wallets_status').on(
      table.network,
      table.status
    ),
    idxCustodialWalletsAddress: index('idx_custodial_wallets_address').on(table.address),
  })
);

/**
 * Activity Log table
 *
 * Event audit trail.
 * Network-aware for bounty/payout events, network-agnostic for user/repo events.
 */
export const activityLog = pgTable(
  'activity_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Event classification
    eventType: varchar('event_type', { length: 50, enum: activityActions }).notNull(),
    network: varchar('network', { length: 10 }),

    // References (all nullable - depends on event type)
    userId: text('user_id').references(() => user.id),
    repoSettingsId: i64('repo_settings_id').references(() => repoSettings.githubRepoId),
    bountyId: uuid('bounty_id').references(() => bounties.id),
    submissionId: uuid('submission_id').references(() => submissions.id),
    payoutId: uuid('payout_id').references(() => payouts.id),

    // Event data
    metadata: jsonb('metadata').$type<ActivityMetadata>().default({}),

    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  },
  (table) => ({
    idxActivityLogEventType: index('idx_activity_log_event_type').on(table.eventType),
    idxActivityLogNetwork: index('idx_activity_log_network').on(table.network),
    idxActivityLogUser: index('idx_activity_log_user').on(table.userId),
    idxActivityLogCreatedAt: index('idx_activity_log_created_at').on(table.createdAt),
  })
);

/**
 * Notifications table
 *
 * User-specific in-app notifications.
 * Not network-specific (user sees unified feed across both networks).
 * Notifications include network info in metadata if relevant.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    // Notification content
    type: varchar('type', { length: 50 }).notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    linkUrl: text('link_url').notNull(),

    // Read tracking
    readAt: timestamp('read_at', { mode: 'string' }),

    // Event metadata
    metadata: jsonb('metadata').$type<NotificationMetadata>().default({}),

    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'string' })
      .defaultNow()
      .$onUpdate(() => new Date().toISOString()),
  },
  (table) => ({
    idxNotificationsUser: index('idx_notifications_user').on(table.userId),
    idxNotificationsUnread: index('idx_notifications_unread')
      .on(table.userId, table.createdAt)
      .where(isNull(table.readAt)),
  })
);

/**
 * Access Keys table
 *
 * Stores user authorizations for backend signing via Tempo Access Keys.
 * Enables automated bounty payouts without requiring manual passkey signature each time.
 *
 * Flow:
 * 1. User signs KeyAuthorization with passkey (granting backend key spending permission)
 * 2. Backend stores authorization proof in this table
 * 3. Backend uses Turnkey-managed secp256k1 key to sign payouts via Keychain signature
 * 4. Tempo validates authorization on-chain via Account Keychain Precompile
 *
 * Spending limits are enforced ON-CHAIN by Tempo (not just in our DB).
 * Backend must check on-chain remaining limit before signing.
 *
 * Limits format (JSONB):
 * {
 *   "0xTokenAddr": { "initial": "1000000000", "remaining": "500000000" },
 *   ...
 * }
 * Updated each time user adds bounty funding.
 *
 * Activity tracking:
 * Access Key events are logged in activity_log table with event types:
 * - access_key_created
 * - access_key_used
 * - access_key_revoked
 * - access_key_expired
 * - access_key_limit_exceeded
 */
export const accessKeys = pgTable(
  'access_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    network: varchar('network', { length: 10, enum: tempoNetworks }).notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    // Turnkey backend wallet address (identifier, not private key!)
    // This is the keyId in KeyAuthorization
    backendWalletAddress: varchar('backend_wallet_address', { length: 42 }).notNull(),

    // Authorization parameters
    keyType: accessKeyTypeEnum('key_type').notNull().default('secp256k1'),
    chainId: integer('chain_id').notNull(), // 42429 for testnet, 0 for any chain
    expiry: i64('expiry'), // Unix timestamp (NULL = no expiry)

    // Dynamic spending limits per token
    // Format: { "0xTokenAddr": { initial: "1000000000", remaining: "500000000" } }
    // Updated each time user adds bounty funding
    limits: jsonb('limits').$type<AccessKeyLimits>().notNull().default({}),

    // Authorization proof (signed by user's passkey)
    authorizationSignature: text('authorization_signature').notNull(),
    authorizationHash: varchar('authorization_hash', { length: 66 }).notNull(),

    // Status tracking
    status: varchar('status', { length: 20, enum: accessKeyStatuses }).notNull().default('active'),
    revokedAt: timestamp('revoked_at', { mode: 'string' }),
    revokedReason: text('revoked_reason'),

    // Metadata
    label: varchar('label', { length: 100 }),
    lastUsedAt: timestamp('last_used_at', { mode: 'string' }),

    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'string' })
      .defaultNow()
      .$onUpdate(() => new Date().toISOString()),
  },
  (table) => ({
    // Ensure one active access key per user per network per backend wallet
    // Note: Partial unique index (WHERE status = 'active') allows multiple revoked/expired keys
    uniqueActiveKey: unique('idx_access_keys_unique_active').on(
      table.userId,
      table.backendWalletAddress,
      table.network
    ),
    idxAccessKeysUser: index('idx_access_keys_user').on(table.userId, table.network),
    idxAccessKeysStatus: index('idx_access_keys_status').on(table.status),
    idxAccessKeysBackendWallet: index('idx_access_keys_backend_wallet').on(
      table.backendWalletAddress
    ),
  })
);
