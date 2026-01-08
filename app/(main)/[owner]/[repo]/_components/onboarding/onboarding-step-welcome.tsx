'use client';

import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowRight, CircleDollarSign, GitPullRequest, Trophy } from 'lucide-react';

interface OnboardingStepWelcomeProps {
  repoName: string;
  onNext: () => void;
}

export function OnboardingStepWelcome({ repoName, onNext }: OnboardingStepWelcomeProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-lg">You&apos;ve claimed {repoName}!</DialogTitle>
        <DialogDescription>
          GRIP lets you create bounties on GitHub issues. Contributors solve issues, you pay them in
          USDC.
        </DialogDescription>
      </DialogHeader>

      {/* How it works diagram */}
      <div className="py-4">
        <div className="flex items-center justify-center gap-2 text-sm">
          <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-muted/50">
            <CircleDollarSign className="h-5 w-5 text-primary" />
            <span className="text-xs font-medium">Create Bounty</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-muted/50">
            <GitPullRequest className="h-5 w-5 text-primary" />
            <span className="text-xs font-medium">PR Merged</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-muted/50">
            <Trophy className="h-5 w-5 text-primary" />
            <span className="text-xs font-medium">Payout Sent</span>
          </div>
        </div>
      </div>

      {/* Steps explanation */}
      <div className="space-y-2 text-sm text-muted-foreground">
        <div className="flex gap-3">
          <span className="font-medium text-foreground">1.</span>
          <span>Pick an issue and set a bounty amount</span>
        </div>
        <div className="flex gap-3">
          <span className="font-medium text-foreground">2.</span>
          <span>Contributors link their PRs to the issue</span>
        </div>
        <div className="flex gap-3">
          <span className="font-medium text-foreground">3.</span>
          <span>When you merge the PR, they get paid</span>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={onNext}>
          Next: Set Up Wallet
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </>
  );
}
