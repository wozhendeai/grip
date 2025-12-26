import { TokenAmount } from '@/components/tempo/token-amount';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import Link from 'next/link';

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
  return (
    <Card className="rounded-xl">
      <CardContent className="p-6">
        <div className="divide-y divide-border">
          <div className="flex items-baseline justify-between py-4 first:pt-0">
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-emerald-600">
                <TokenAmount amount={totalFunded} symbol="" />
              </span>
              <span className="text-sm text-muted-foreground mt-1">USDC Funded</span>
            </div>
          </div>

          <div className="flex items-baseline justify-between py-4">
            <div className="flex flex-col">
              <span className="text-3xl font-bold text-amber-500">{openBounties}</span>
              <span className="text-sm text-muted-foreground mt-1">Open Bounties</span>
            </div>
          </div>

          <div className="flex items-baseline justify-between py-4 last:pb-0">
            <div className="flex flex-col">
              <span className="text-3xl font-bold text-slate-400">{completedBounties}</span>
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
            className="w-full mt-4 bg-slate-900 hover:bg-slate-800"
          />
        )}

        {isLoggedIn && (canManage || !isClaimed) && (
          <div className="mt-6 pt-4 border-t border-border text-center">
            <p className="text-sm text-muted-foreground mb-1">
              {!isClaimed ? (
                <>
                  Maintainer?{' '}
                  <Link
                    href={`/${owner}/${repo}/settings`}
                    className="text-primary font-medium hover:underline"
                  >
                    Claim this repo
                  </Link>
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
