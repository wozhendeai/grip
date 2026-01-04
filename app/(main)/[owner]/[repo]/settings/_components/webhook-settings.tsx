'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, Webhook, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

/**
 * Format a date as relative time (e.g., "5 minutes ago", "2 hours ago")
 */
function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;

  return date.toLocaleDateString();
}

interface WebhookSettingsProps {
  githubRepoId: number;
}

type WebhookStatus = 'connected' | 'degraded' | 'disconnected' | 'not_configured';

interface WebhookDelivery {
  id: string;
  eventType: string;
  action: string | null;
  status: 'success' | 'failed';
  errorMessage: string | null;
  payloadSummary: {
    prNumber?: number;
    issueNumber?: number;
    username?: string;
    repoFullName?: string;
  } | null;
  receivedAt: string;
}

interface WebhookData {
  status: WebhookStatus;
  lastEventTime: string | null;
  installationId: string | null;
  deliveries: WebhookDelivery[];
}

const STATUS_CONFIG: Record<
  WebhookStatus,
  {
    label: string;
    description: string;
    color: string;
    textColor: string;
    icon: typeof CheckCircle2;
  }
> = {
  connected: {
    label: 'Connected',
    description: 'Receiving webhook events normally',
    color: 'bg-success',
    textColor: 'text-success',
    icon: CheckCircle2,
  },
  degraded: {
    label: 'Degraded',
    description: 'No events received in the last 24 hours',
    color: 'bg-chart-4',
    textColor: 'text-chart-4',
    icon: AlertCircle,
  },
  disconnected: {
    label: 'Disconnected',
    description: 'No events received in over 7 days',
    color: 'bg-destructive',
    textColor: 'text-destructive',
    icon: XCircle,
  },
  not_configured: {
    label: 'Not Configured',
    description: 'GitHub App not installed for this repository',
    color: 'bg-muted-foreground',
    textColor: 'text-muted-foreground',
    icon: AlertCircle,
  },
};

/**
 * Webhook settings component
 *
 * Displays:
 * - Connection status indicator (connected/degraded/disconnected/not_configured)
 * - Recent webhook delivery log (last 20 events)
 * - Instructions for GitHub App installation if not configured
 */
export function WebhookSettings({ githubRepoId }: WebhookSettingsProps) {
  const [webhookData, setWebhookData] = useState<WebhookData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchWebhookData = useCallback(async () => {
    try {
      const res = await fetch(`/api/repo-settings/${githubRepoId}/webhooks`);
      if (res.ok) {
        const data = await res.json();
        setWebhookData(data);
      }
    } catch (err) {
      console.error('Failed to fetch webhook status:', err);
    } finally {
      setIsLoading(false);
    }
  }, [githubRepoId]);

  useEffect(() => {
    fetchWebhookData();
  }, [fetchWebhookData]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            GitHub Integration
          </CardTitle>
          <CardDescription>Loading webhook status...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const status = webhookData?.status ?? 'not_configured';
  const statusConfig = STATUS_CONFIG[status];
  const StatusIcon = statusConfig.icon;

  return (
    <>
      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            GitHub Integration
          </CardTitle>
          <CardDescription>Webhook connection status for PR and issue tracking</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Indicator */}
          <div className="flex items-center gap-4">
            <div className={cn('h-4 w-4 rounded-full', statusConfig.color)} />
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{statusConfig.label}</p>
                <StatusIcon className={cn('h-4 w-4', statusConfig.textColor)} />
              </div>
              <p className="text-sm text-muted-foreground">{statusConfig.description}</p>
            </div>
          </div>

          {/* Last Event Time */}
          {webhookData?.lastEventTime && (
            <div className="text-sm text-muted-foreground">
              Last event:{' '}
              <span className="font-medium">
                {formatRelativeTime(new Date(webhookData.lastEventTime))}
              </span>
            </div>
          )}

          {/* Not Configured - Show Installation Link */}
          {status === 'not_configured' && (
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <h4 className="font-medium mb-2">Install GitHub App</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Install the GRIP GitHub App to enable automatic webhook delivery for PR and issue
                tracking.
              </p>
              <a
                href="https://github.com/apps/grip-bounties"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Install GitHub App
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Manual Setup Instructions (for reference) */}
          {status === 'not_configured' && (
            <div className="border-t pt-4">
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Manual webhook setup (advanced)
                </summary>
                <div className="mt-3 space-y-3 text-muted-foreground">
                  <div>
                    <p className="font-medium text-foreground">Payload URL:</p>
                    <code className="text-xs bg-muted px-2 py-1 rounded block mt-1">
                      {typeof window !== 'undefined' ? window.location.origin : ''}
                      /api/webhooks/github
                    </code>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Content type:</p>
                    <code className="text-xs bg-muted px-2 py-1 rounded inline-block mt-1">
                      application/json
                    </code>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Events to select:</p>
                    <ul className="list-disc list-inside mt-1">
                      <li>Pull requests</li>
                      <li>Issues</li>
                    </ul>
                  </div>
                </div>
              </details>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Events Log */}
      {webhookData?.deliveries && webhookData.deliveries.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Recent Events</CardTitle>
            <CardDescription>
              Last {webhookData.deliveries.length} webhook deliveries
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {webhookData.deliveries.map((delivery) => (
                <div
                  key={delivery.id}
                  className="flex items-center justify-between py-3 border-b last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    {/* Status Dot */}
                    <div
                      className={cn(
                        'h-2 w-2 rounded-full',
                        delivery.status === 'success' ? 'bg-success' : 'bg-destructive'
                      )}
                    />
                    <div>
                      <p className="font-medium text-sm">{formatEventTitle(delivery)}</p>
                      <p className="text-xs text-muted-foreground">
                        {delivery.eventType}
                        {delivery.action && `.${delivery.action}`}
                      </p>
                      {delivery.status === 'failed' && delivery.errorMessage && (
                        <p className="text-xs text-destructive mt-1">{delivery.errorMessage}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatRelativeTime(new Date(delivery.receivedAt))}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Events Yet */}
      {webhookData?.deliveries?.length === 0 && status !== 'not_configured' && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Recent Events</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">No webhook events received yet.</p>
          </CardContent>
        </Card>
      )}
    </>
  );
}

/**
 * Format a webhook delivery into a human-readable title
 */
function formatEventTitle(delivery: WebhookDelivery): string {
  const { prNumber, issueNumber, username } = delivery.payloadSummary ?? {};

  if (prNumber) {
    return `PR #${prNumber}${username ? ` by ${username}` : ''}`;
  }

  if (issueNumber) {
    return `Issue #${issueNumber}${username ? ` by ${username}` : ''}`;
  }

  // Fallback to event type for installation events, etc.
  if (delivery.eventType === 'installation') {
    return `App ${delivery.action ?? 'event'}`;
  }

  if (delivery.eventType === 'ping') {
    return 'Webhook configured';
  }

  return delivery.eventType;
}
