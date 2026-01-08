import { db, webhookDeliveries } from '@/db';
import { desc, eq } from 'drizzle-orm';

export type CreateWebhookDeliveryInput = {
  githubDeliveryId: string;
  githubRepoId?: bigint | string | null;
  githubInstallationId?: bigint | string | null;
  eventType: string;
  action?: string | null;
  status: 'success' | 'failed';
  errorMessage?: string | null;
  payloadSummary?: {
    prNumber?: number;
    issueNumber?: number;
    username?: string;
    repoFullName?: string;
  } | null;
  processedAt?: Date;
};

/**
 * Create a webhook delivery record
 *
 * Called after processing each GitHub webhook event to track
 * delivery status and enable the events log UI.
 */
export async function createWebhookDelivery(input: CreateWebhookDeliveryInput) {
  const githubRepoId = input.githubRepoId
    ? typeof input.githubRepoId === 'string'
      ? BigInt(input.githubRepoId)
      : input.githubRepoId
    : null;

  const githubInstallationId = input.githubInstallationId
    ? typeof input.githubInstallationId === 'string'
      ? BigInt(input.githubInstallationId)
      : input.githubInstallationId
    : null;

  const [delivery] = await db
    .insert(webhookDeliveries)
    .values({
      githubDeliveryId: input.githubDeliveryId,
      githubRepoId,
      githubInstallationId,
      eventType: input.eventType,
      action: input.action ?? null,
      status: input.status,
      errorMessage: input.errorMessage ?? null,
      payloadSummary: input.payloadSummary ?? null,
      processedAt: input.processedAt?.toISOString() ?? null,
    })
    .returning();

  return delivery;
}

/**
 * Get recent webhook deliveries for a repo
 *
 * Returns the last N deliveries for display in the webhook settings UI.
 * Used for both status indicator and events log.
 */
export async function getRecentDeliveriesByRepoId(githubRepoId: bigint | string, limit = 20) {
  const repoIdBigInt = typeof githubRepoId === 'string' ? BigInt(githubRepoId) : githubRepoId;

  return db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.githubRepoId, repoIdBigInt))
    .orderBy(desc(webhookDeliveries.receivedAt))
    .limit(limit);
}

/**
 * Get the most recent successful delivery for a repo
 *
 * Used to determine webhook connection status:
 * - If within 24h: connected (green)
 * - If within 7d: degraded (yellow)
 * - If older or none: disconnected (red)
 */
export async function getLastSuccessfulDeliveryByRepoId(githubRepoId: bigint | string) {
  const repoIdBigInt = typeof githubRepoId === 'string' ? BigInt(githubRepoId) : githubRepoId;

  const [delivery] = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.githubRepoId, repoIdBigInt))
    .orderBy(desc(webhookDeliveries.receivedAt))
    .limit(1);

  return delivery ?? null;
}
