'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useSession } from '@/lib/auth-client';
import { CheckCircle, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface ClaimRepoCardProps {
  repoFullName: string;
}

/**
 * Claim Repository Card
 *
 * Shows call-to-action for users with push access to claim unclaimed repos.
 * Claiming a repo unlocks:
 * - Webhook auto-install (for PR merge detection)
 * - Settings access (auto-approve, payout mode)
 * - Maintainer badge on repo page
 */
export function ClaimRepoCard({ repoFullName }: ClaimRepoCardProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClaim() {
    setClaiming(true);
    setError(null);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoFullName }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to claim repository');
      }

      // Success - refresh the page to show claimed state
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to claim repository');
    } finally {
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
              Unlock additional features for this repository by claiming it.
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
              {claiming ? 'Claiming...' : 'Claim Repository'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
