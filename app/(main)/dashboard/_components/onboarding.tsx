'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  Github,
  Wallet,
  GitFork,
  DollarSign,
  Trophy,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { OnboardingStatus } from '@/db/queries/bounties';
import { skipOnboarding } from '../actions';

interface OnboardingProps {
  status: OnboardingStatus;
}

type Step = {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: React.ElementType;
  isCompleted: boolean;
  isCurrent: boolean;
  isDisabled: boolean;
};

export function Onboarding({ status }: OnboardingProps) {
  const [isSkipping, setIsSkipping] = useState(false);

  // Determine user path based on activity
  // If they have claimed a bounty, they are on the contributor path
  const isContributor = status.firstBountyClaimed;

  // Org members get shortcuts
  const isOrgMember = status.isOrgMember;

  // Path definition
  const pathType = isContributor ? 'contributor' : 'funder';

  const handleSkip = async () => {
    setIsSkipping(true);
    await skipOnboarding();
  };

  // Define steps based on path
  // Funder: GitHub -> Wallet -> (Repo) -> Fund
  // Contributor: GitHub -> Wallet -> Claim

  const steps: Step[] = [];

  // Step 1: GitHub (Common)
  steps.push({
    id: 'github',
    label: 'Connected GitHub',
    description: status.githubConnected ? 'Account linked' : 'Link your GitHub account',
    href: '#',
    icon: Github,
    isCompleted: status.githubConnected,
    isCurrent: !status.githubConnected,
    isDisabled: status.githubConnected, // Already done
  });

  // Step 2: Wallet (Common)
  // Org members have this auto-provisioned usually, or handled.
  // If isOrgMember, we assume wallet is handled or they are part of org wallet context
  // But status.walletCreated checks passkeys.
  // Prompt: "Auto-complete 'Create wallet' if org provisioned one".
  // Logic: if isOrgMember, treat wallet as created if not explicitly so?
  // status.walletCreated is from DB. If org provisioned, likely it shows up there or we treat it as done.
  const walletDone = status.walletCreated || isOrgMember;

  steps.push({
    id: 'wallet',
    label: walletDone ? 'Created wallet' : 'Create wallet',
    description: walletDone
      ? isOrgMember
        ? 'Organization wallet active'
        : '0x... connected'
      : 'Create a secure wallet for funds',
    href: '/settings/wallets',
    icon: Wallet,
    isCompleted: walletDone,
    isCurrent: status.githubConnected && !walletDone,
    isDisabled: !status.githubConnected || walletDone,
  });

  if (pathType === 'funder') {
    // Step 3: Connect Repo
    // Skipped for Org Members (they inherit repos)
    const repoDone = status.repoConnected || isOrgMember;

    steps.push({
      id: 'repo',
      label: repoDone ? 'Connect a repository' : 'Connect a repository',
      description: repoDone
        ? isOrgMember
          ? 'Access to organization repos'
          : 'Repository connected'
        : 'Install GRIP to create bounties',
      href: '/settings/repos',
      icon: GitFork,
      isCompleted: repoDone,
      isCurrent: walletDone && !repoDone,
      isDisabled: !walletDone || repoDone,
    });

    // Step 4: Fund Bounty
    steps.push({
      id: 'fund',
      label: 'Fund your first bounty',
      description: 'Create a bounty on any issue',
      href: '/bounties/new',
      icon: DollarSign,
      isCompleted: status.firstBountyFunded,
      isCurrent: walletDone && repoDone && !status.firstBountyFunded,
      isDisabled: !walletDone || !repoDone || status.firstBountyFunded,
    });
  } else {
    // Contributor Path
    // Step 3: Claim Bounty
    steps.push({
      id: 'claim',
      label: 'Claim your first bounty',
      description: 'Find and solve an issue',
      href: '/explore',
      icon: Trophy,
      isCompleted: status.firstBountyClaimed,
      isCurrent: walletDone && !status.firstBountyClaimed,
      isDisabled: !walletDone || status.firstBountyClaimed,
    });
  }

  const completedCount = steps.filter((s) => s.isCompleted).length;
  const totalSteps = steps.length;

  return (
    <Card className="h-full border-border bg-card shadow-sm flex flex-col py-0 gap-0">
      <CardHeader className="border-b border-border bg-muted/40 py-3 px-4 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-semibold">Get Started</CardTitle>
        <div className="text-xs font-medium text-muted-foreground whitespace-nowrap">
          {completedCount}/{totalSteps} complete
        </div>
      </CardHeader>

      <CardContent className="p-2 flex-1 overflow-y-auto">
        <div className="space-y-1">
          {steps.map((step) => (
            <StepItem key={step.id} step={step} />
          ))}
        </div>
      </CardContent>

      {!isContributor && !status.allComplete && (
        <div className="px-4 py-2 border-t border-border bg-muted/20">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            disabled={isSkipping}
            className="w-full h-8 text-xs text-muted-foreground hover:text-foreground justify-between group"
          >
            <span>Just here to contribute?</span>
            <span className="flex items-center">
              Skip setup
              {isSkipping ? (
                <Loader2 className="h-3 w-3 ml-2 animate-spin" />
              ) : (
                <ArrowRight className="h-3 w-3 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </span>
          </Button>
        </div>
      )}
    </Card>
  );
}

function StepItem({ step }: { step: Step }) {
  const Icon = step.isCompleted ? CheckCircle2 : step.icon;
  const isClickable = !step.isDisabled && !step.isCompleted;

  return (
    <Link
      href={isClickable ? step.href : '#'}
      className={cn(
        'flex items-start gap-3 p-2.5 rounded-md transition-all duration-200 group relative',
        step.isCurrent ? 'bg-muted/60 ring-1 ring-border shadow-sm' : 'hover:bg-muted/40',
        step.isDisabled && 'opacity-50 pointer-events-none',
        step.isCompleted && 'opacity-60'
      )}
    >
      <div
        className={cn(
          'shrink-0 mt-0.5 transition-colors',
          step.isCompleted
            ? 'text-primary'
            : step.isCurrent
              ? 'text-foreground'
              : 'text-muted-foreground'
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'text-sm font-medium leading-none truncate',
              step.isCompleted ? 'text-muted-foreground/80 decoration-border/50' : 'text-foreground'
            )}
          >
            {step.label}
          </span>
          {step.isCurrent && !step.isCompleted && (
            <ArrowRight className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" />
          )}
        </div>
        <p
          className={cn(
            'text-xs text-muted-foreground mt-1 line-clamp-1',
            step.isCompleted && 'hidden'
          )}
        >
          {step.description}
        </p>
      </div>
    </Link>
  );
}
