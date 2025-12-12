'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface GeneralSettingsProps {
  githubRepoId: number;
}

/**
 * General repo settings
 *
 * In the promise model, most settings are simplified.
 * This section is kept for future configuration options.
 */
export function GeneralSettings({ githubRepoId }: GeneralSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>General Settings</CardTitle>
        <CardDescription>Basic repository configuration</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-sm text-muted-foreground">
          <p>
            Your repository is configured for bounties. Anyone can fund issues in this repo, and you
            (the repo owner) control which submissions get approved for payment.
          </p>
          <p className="mt-4">
            Submissions stay pending until you approve or reject them - no expiration deadlines.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
