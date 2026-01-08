'use client';

import { AddressDisplay } from '@/components/tempo/address-display';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2, CircleDollarSign, Hand, PartyPopper, Plus, Wallet, Zap } from 'lucide-react';
import Link from 'next/link';

interface OnboardingStepCompleteProps {
  repo: {
    owner: string;
    name: string;
  };
  hasWallet: boolean;
  walletAddress: string | null;
  autoPayEnabled: boolean;
  onComplete: () => void;
}

export function OnboardingStepComplete({
  repo,
  hasWallet,
  walletAddress,
  autoPayEnabled,
  onComplete,
}: OnboardingStepCompleteProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-lg flex items-center gap-2">
          <PartyPopper className="h-5 w-5" />
          You&apos;re all set!
        </DialogTitle>
        <DialogDescription>{repo.name} is ready to offer bounties.</DialogDescription>
      </DialogHeader>

      {/* Summary */}
      <div className="py-4">
        <div className="p-4 bg-muted/50 rounded-lg space-y-3">
          {/* Wallet */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Wallet</span>
            </div>
            {hasWallet && walletAddress ? (
              <AddressDisplay address={walletAddress} truncate />
            ) : (
              <span className="text-sm text-chart-4">Not configured</span>
            )}
          </div>

          {/* Payouts */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {autoPayEnabled ? (
                <Zap className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Hand className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">Payouts</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {autoPayEnabled ? 'Automatic' : 'Manual approval'}
            </span>
          </div>
        </div>
      </div>

      {/* CTAs */}
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">What would you like to do next?</p>

        <div className="grid grid-cols-2 gap-3">
          {/* Create Bounty */}
          <Button
            variant="outline"
            className="h-auto flex-col gap-2 py-4"
            onClick={onComplete}
            render={<Link href={`/${repo.owner}/${repo.name}/bounties/new`} />}
          >
            <Plus className="h-5 w-5" />
            <div className="text-center">
              <p className="font-medium">Create Bounty</p>
              <p className="text-xs text-muted-foreground">Pick an issue</p>
            </div>
          </Button>

          {/* Fund Wallet */}
          <Button
            variant="outline"
            className="h-auto flex-col gap-2 py-4"
            onClick={onComplete}
            render={<Link href={`/${repo.owner}/${repo.name}/settings?tab=treasury`} />}
          >
            <CircleDollarSign className="h-5 w-5" />
            <div className="text-center">
              <p className="font-medium">Fund Wallet</p>
              <p className="text-xs text-muted-foreground">Add USDC</p>
            </div>
          </Button>
        </div>

        <div className="text-center pt-2">
          <Button variant="ghost" size="sm" onClick={onComplete}>
            Skip for now
          </Button>
        </div>
      </div>
    </>
  );
}
