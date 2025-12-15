'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, Webhook } from 'lucide-react';

interface WebhookSettingsProps {
  githubRepoId: number;
}

/**
 * Webhook settings placeholder
 *
 * Future: Will allow installing/managing GitHub webhooks.
 * For now, shows instructions for manual webhook setup.
 */
export function WebhookSettings({ githubRepoId }: WebhookSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Webhook className="h-5 w-5" />
          GitHub Webhooks
          <Badge variant="secondary">Coming Soon</Badge>
        </CardTitle>
        <CardDescription>Automatically track pull requests linked to bounties</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Status */}
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <h4 className="font-medium mb-2">Manual Setup Required</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Until automatic webhook installation is available, you can manually configure webhooks
            in your GitHub repository settings.
          </p>

          <div className="space-y-3 text-sm">
            <div>
              <p className="font-medium">Payload URL:</p>
              <code className="text-xs bg-muted px-2 py-1 rounded block mt-1">
                {typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/github
              </code>
            </div>

            <div>
              <p className="font-medium">Content type:</p>
              <code className="text-xs bg-muted px-2 py-1 rounded inline-block mt-1">
                application/json
              </code>
            </div>

            <div>
              <p className="font-medium">Events to select:</p>
              <ul className="list-disc list-inside text-muted-foreground mt-1">
                <li>Pull requests</li>
                <li>Issues</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Instructions Link */}
        <a
          href="https://docs.github.com/en/webhooks/using-webhooks/creating-webhooks"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          GitHub Webhooks Documentation
          <ExternalLink className="h-3 w-3" />
        </a>
      </CardContent>
    </Card>
  );
}
