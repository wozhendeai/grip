'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { authClient } from '@/lib/auth-client';

/**
 * Claim Login Prompt Component
 *
 * Prompts unauthenticated users to log in with GitHub to claim their payment.
 */

type ClaimLoginPromptProps = {
  custodialWallet: {
    githubUsername: string;
    address: string;
  };
  returnUrl: string;
};

export function ClaimLoginPrompt({ custodialWallet, returnUrl }: ClaimLoginPromptProps) {
  const handleGitHubLogin = async () => {
    await authClient.signIn.social({
      provider: 'github',
      callbackURL: returnUrl,
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <span className="text-3xl">💰</span>
          </div>

          <div className="gap-2">
            <h1 className="heading-2">Claim Your Payment</h1>
            <p className="body-base text-muted-foreground">
              You've received a bounty payment! Log in with GitHub to claim it.
            </p>
          </div>

          <div className="w-full rounded-lg bg-muted p-4 gap-2">
            <p className="body-sm text-muted-foreground">Payment for:</p>
            <p className="body-base font-medium">@{custodialWallet.githubUsername}</p>
            <p className="body-sm text-muted-foreground mt-2">Held in secure wallet:</p>
            <p className="font-mono body-sm break-all">{custodialWallet.address}</p>
          </div>

          <Button onClick={handleGitHubLogin} className="w-full" size="lg">
            Log in with GitHub to Claim
          </Button>

          <p className="body-sm text-muted-foreground">
            You must log in with the GitHub account that completed the bounty.
          </p>
        </div>
      </Card>
    </div>
  );
}
