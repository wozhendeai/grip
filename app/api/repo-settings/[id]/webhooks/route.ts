import { getRepoSettingsByGithubRepoId } from '@/db/queries/repo-settings';
import {
  getLastSuccessfulDeliveryByRepoId,
  getRecentDeliveriesByRepoId,
} from '@/db/queries/webhook-deliveries';
import { type NextRequest, NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export type WebhookStatus = 'connected' | 'degraded' | 'disconnected' | 'not_configured';

/**
 * Determine webhook connection status based on installation and recent deliveries
 */
function determineWebhookStatus(
  installationId: bigint | null,
  lastDeliveryTime: Date | null
): WebhookStatus {
  // No GitHub App installation
  if (!installationId) {
    return 'not_configured';
  }

  // No deliveries received yet
  if (!lastDeliveryTime) {
    return 'disconnected';
  }

  const hoursSinceLastEvent = (Date.now() - lastDeliveryTime.getTime()) / (1000 * 60 * 60);

  // More than 7 days without events
  if (hoursSinceLastEvent > 168) {
    return 'disconnected';
  }

  // More than 24 hours without events
  if (hoursSinceLastEvent > 24) {
    return 'degraded';
  }

  return 'connected';
}

/**
 * GET /api/repo-settings/[id]/webhooks
 *
 * Returns webhook status and recent events for a repo.
 *
 * Response:
 * - status: 'connected' | 'degraded' | 'disconnected' | 'not_configured'
 * - lastEventTime: ISO timestamp of most recent event (or null)
 * - deliveries: Array of recent webhook deliveries
 * - installationId: GitHub App installation ID (or null)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const githubRepoId = Number.parseInt(id);

    if (Number.isNaN(githubRepoId)) {
      return NextResponse.json({ error: 'Invalid repo ID' }, { status: 400 });
    }

    // Get repo settings for installation info
    const repoSettings = await getRepoSettingsByGithubRepoId(BigInt(githubRepoId));

    if (!repoSettings) {
      return NextResponse.json({ error: 'Repo settings not found' }, { status: 404 });
    }

    // Get recent deliveries and last successful delivery
    const [deliveries, lastDelivery] = await Promise.all([
      getRecentDeliveriesByRepoId(BigInt(githubRepoId), 20),
      getLastSuccessfulDeliveryByRepoId(BigInt(githubRepoId)),
    ]);

    // Determine status based on installation and delivery history
    const lastDeliveryTime = lastDelivery?.receivedAt ? new Date(lastDelivery.receivedAt) : null;
    const status = determineWebhookStatus(repoSettings.installationId, lastDeliveryTime);

    return NextResponse.json({
      status,
      lastEventTime: lastDelivery?.receivedAt ?? null,
      installationId: repoSettings.installationId?.toString() ?? null,
      deliveries: deliveries.map((d) => ({
        id: d.id,
        eventType: d.eventType,
        action: d.action,
        status: d.status,
        errorMessage: d.errorMessage,
        payloadSummary: d.payloadSummary,
        receivedAt: d.receivedAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching webhook status:', error);
    return NextResponse.json({ error: 'Failed to fetch webhook status' }, { status: 500 });
  }
}
