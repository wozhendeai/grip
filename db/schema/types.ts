/**
 * JSONB field types for compile-time safety
 *
 * These types are used with Drizzle's .$type<T>() method to add
 * TypeScript type safety to JSONB columns.
 */

/**
 * GitHub issue label
 * Stored in bounties.labels as JSONB array
 */
export type GithubLabel = {
  id: number;
  name: string;
  color: string;
  description?: string;
};

/**
 * Access key spending limits
 * Stored in access_keys.limits as JSONB object
 *
 * Map of token address → limit tracking
 * Amounts stored as string (BigInt serialization)
 *
 * Example:
 * {
 *   "0x1234...": {
 *     initial: "1000000000",  // 1000 tokens with 6 decimals
 *     remaining: "500000000"   // 500 tokens remaining
 *   }
 * }
 */
export type AccessKeyLimits = {
  [tokenAddress: string]: {
    initial: string; // BigInt as string
    remaining: string; // BigInt as string
  };
};

/**
 * Activity log metadata
 * Stored in activity_log.metadata as JSONB object
 *
 * Extensible event data for different activity types
 */
export type ActivityMetadata = {
  bountyId?: string;
  submissionId?: string;
  payoutId?: string;
  amount?: string; // BigInt as string
  tokenSymbol?: string;
  tokenAddress?: string;
  githubUrl?: string;
  [key: string]: unknown; // Allow arbitrary metadata
};

/**
 * Notification metadata
 * Stored in notifications.metadata as JSONB object
 *
 * Event-specific data for rendering notifications
 * Currently uses same shape as ActivityMetadata
 */
export type NotificationMetadata = ActivityMetadata;
