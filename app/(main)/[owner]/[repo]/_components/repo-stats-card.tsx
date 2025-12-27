'use client';

import { TokenAmount } from '@/components/tempo/token-amount';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface RepoStatsCardProps {
  owner: string;
  repo: string;
  totalFunded: string;
  openBounties: number;
  completedBounties: number;
  isClaimed: boolean;
  canManage: boolean;
  isLoggedIn: boolean;
}

export function RepoStatsCard({
  owner,
  repo,
  totalFunded,
  openBounties,
  completedBounties,
  isClaimed,
  canManage,
  isLoggedIn,
}: RepoStatsCardProps) {
  const [claiming, setClaiming] = useState(false);

  async function handleClaim() {
    setClaiming(true);
    try {
      const res = await fetch(`/api/repos/${owner}/${repo}/claim`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = data.installUrl;
    } catch {
      setClaiming(false);
    }
  }
  return (
    <Card className="rounded-xl">
      <CardContent className="p-6">
        <div className="divide-y divide-border">
          <div className="flex items-baseline justify-between py-4 first:pt-0">
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-primary">
                <TokenAmount amount={totalFunded} symbol="" />
              </span>
              <span className="text-sm text-muted-foreground mt-1">USDC Funded</span>
            </div>
          </div>

          <div className="flex items-baseline justify-between py-4">
            <div className="flex flex-col">
              <span className="text-3xl font-bold text-chart-4">{openBounties}</span>
              <span className="text-sm text-muted-foreground mt-1">Open Bounties</span>
            </div>
          </div>

          <div className="flex items-baseline justify-between py-4 last:pb-0">
            <div className="flex flex-col">
              <span className="text-3xl font-bold text-muted-foreground">{completedBounties}</span>
              <span className="text-sm text-muted-foreground mt-1">Completed</span>
            </div>
          </div>
        </div>

        {isLoggedIn && (
          <Button
            render={
              <Link href={`/${owner}/${repo}/bounties/new`}>
                <Plus className="h-4 w-4 mr-2" />
                Create Bounty
              </Link>
            }
            className="w-full mt-4"
          />
        )}

        {isLoggedIn && (canManage || !isClaimed) && (
          <div className="mt-6 pt-4 border-t border-border text-center">
            <p className="text-sm text-muted-foreground mb-1">
              {!isClaimed ? (
                <>
                  Maintainer?{' '}
                  <button
                    type="button"
                    onClick={handleClaim}
                    disabled={claiming}
                    className="text-primary font-medium hover:underline disabled:opacity-50"
                  >
                    {claiming ? 'Redirecting...' : 'Claim this repo'}
                  </button>
                </>
              ) : (
                <Link
                  href={`/${owner}/${repo}/settings`}
                  className="text-primary font-medium hover:underline"
                >
                  Project settings
                </Link>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {!isClaimed
                ? 'Enable webhooks and auto-approval'
                : 'Manage webhooks, treasury, and permissions'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
