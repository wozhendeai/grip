'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useSession } from '@/lib/auth/auth-client';
import { CheckCircle, ExternalLink, Sparkles } from 'lucide-react';
import { useState } from 'react';

interface ClaimRepoCardProps {
  owner: string;
  repo: string;
}

/**
 * Claim Repository Card
 *
 * Shows call-to-action for users to claim a repo by installing the GRIP GitHub App.
 * Claiming a repo unlocks:
 * - Webhook auto-install (for PR merge detection)
 * - Settings access (auto-approve, payout mode)
 * - Maintainer badge on repo page
 */
export function ClaimRepoCard({ owner, repo }: ClaimRepoCardProps) {
  const { data: session } = useSession();
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClaim() {
    setClaiming(true);
    setError(null);

    try {
      const res = await fetch(`/api/repos/${owner}/${repo}/claim`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to initiate claim');
      }

      // Redirect to GitHub App installation page
      window.location.href = data.installUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to claim repository');
      setClaiming(false);
    }
  }

  if (!session) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-primary/10 p-3">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="heading-3">Claim this repository</h3>
            <p className="body-base text-muted-foreground mt-2">
              Install the GRIP Bounties GitHub App to unlock additional features.
            </p>

            <div className="mt-4 space-y-2">
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-primary mt-0.5" />
                <span>Automatic webhook installation for PR merge detection</span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-primary mt-0.5" />
                <span>Access to repository settings (auto-approve, payout modes)</span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-primary mt-0.5" />
                <span>Maintainer badge displayed on your repo page</span>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button onClick={handleClaim} disabled={claiming} className="mt-6">
              {claiming ? (
                'Redirecting to GitHub...'
              ) : (
                <>
                  Install GRIP App
                  <ExternalLink className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
