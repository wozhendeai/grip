import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getExplorerTxUrl } from '@/lib/tempo/constants';
import Link from 'next/link';

/**
 * Claim Error Component
 *
 * Shows error states for invalid, expired, or already claimed payments.
 */

type ClaimErrorProps = {
  title: string;
  message: string;
  txHash?: string;
};

export function ClaimError({ title, message, txHash }: ClaimErrorProps) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <span className="text-3xl">❌</span>
          </div>

          <div className="gap-2">
            <h1 className="heading-2">{title}</h1>
            <p className="body-base text-muted-foreground">{message}</p>
          </div>

          {txHash && (
            <div className="w-full gap-2">
              <p className="body-sm text-muted-foreground">View transaction:</p>
              <a
                href={getExplorerTxUrl(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="body-sm text-primary hover:underline break-all"
              >
                {txHash}
              </a>
            </div>
          )}

          <Button render={<Link href="/explore" />}>Explore Bounties</Button>
        </div>
      </Card>
    </div>
  );
}
