'use client';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { OnboardingProgress } from './onboarding-progress';
import { OnboardingStepAutopay } from './onboarding-step-autopay';
import { OnboardingStepComplete } from './onboarding-step-complete';
import { OnboardingStepWallet } from './onboarding-step-wallet';
import { OnboardingStepWelcome } from './onboarding-step-welcome';

export interface RepoOnboardingModalProps {
  repo: {
    owner: string;
    name: string;
    githubRepoId: string;
  };
  user: {
    hasWallet: boolean;
    walletAddress: string | null;
    credentialId: string | null;
    hasAccessKey: boolean;
  };
}

export function RepoOnboardingModal({ repo, user }: RepoOnboardingModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(1);
  const [autoPayEnabled, setAutoPayEnabled] = useState(user.hasAccessKey);
  const [walletAddress, setWalletAddress] = useState(user.walletAddress);
  const [hasWallet, setHasWallet] = useState(user.hasWallet);

  const totalSteps = 4;

  async function handleComplete() {
    // Mark onboarding as complete via API
    try {
      await fetch(`/api/repo-settings/${repo.githubRepoId}/onboarding`, {
        method: 'POST',
      });
    } catch (error) {
      console.error('Failed to mark onboarding complete:', error);
    }

    setOpen(false);

    // Clean up URL param if present
    const url = new URL(window.location.href);
    if (url.searchParams.has('onboarding')) {
      url.searchParams.delete('onboarding');
      router.replace(url.pathname + url.search);
    }
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      handleComplete();
    }
  }

  function handleWalletCreated() {
    // Wallet was just created - update local state
    // The actual address comes from router.refresh() in the wallet step
    setHasWallet(true);
  }

  function handleAutopayNext(settings: { autoPayEnabled: boolean }) {
    setAutoPayEnabled(settings.autoPayEnabled);
    setStep(4);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={step !== 1}>
        <OnboardingProgress current={step} total={totalSteps} />

        {step === 1 && <OnboardingStepWelcome repoName={repo.name} onNext={() => setStep(2)} />}

        {step === 2 && (
          <OnboardingStepWallet
            hasWallet={hasWallet}
            walletAddress={walletAddress}
            onWalletCreated={handleWalletCreated}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}

        {step === 3 && (
          <OnboardingStepAutopay
            hasWallet={hasWallet}
            hasAccessKey={user.hasAccessKey}
            onBack={() => setStep(2)}
            onNext={handleAutopayNext}
          />
        )}

        {step === 4 && (
          <OnboardingStepComplete
            repo={{ owner: repo.owner, name: repo.name }}
            hasWallet={hasWallet}
            walletAddress={walletAddress}
            autoPayEnabled={autoPayEnabled}
            onComplete={handleComplete}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
