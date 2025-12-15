import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowLeftRight, Construction } from 'lucide-react';
import Link from 'next/link';

/**
 * Wallet Swap Page (placeholder)
 *
 * Token swap interface - coming soon.
 * Currently shows a placeholder while DEX integration is in development.
 */
export default function WalletSwapPage() {
  return (
    <div className="container py-12">
      {/* Back link */}
      <Link
        href="/wallet"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Wallet
      </Link>

      {/* Coming Soon */}
      <div className="mx-auto max-w-md text-center">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <ArrowLeftRight className="h-8 w-8 text-muted-foreground" />
        </div>

        <h1 className="text-2xl font-bold">Token Swap</h1>

        <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-2">
          <Construction className="h-4 w-4 text-warning" />
          <span className="text-sm font-medium text-warning">Coming Soon</span>
        </div>

        <p className="mt-6 text-muted-foreground">
          Swap tokens directly in your wallet using Tempo DEX. This feature is currently in
          development.
        </p>

        <div className="mt-8 rounded-lg border border-border bg-card/50 p-6 text-left">
          <h2 className="text-sm font-medium mb-3">What you&apos;ll be able to do:</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-success">&#10003;</span>
              Swap between USDC, USDT, and other tokens
            </li>
            <li className="flex items-start gap-2">
              <span className="text-success">&#10003;</span>
              Get real-time quotes with price impact
            </li>
            <li className="flex items-start gap-2">
              <span className="text-success">&#10003;</span>
              Sign with your passkey - no gas fees
            </li>
          </ul>
        </div>

        <Button render={<Link href="/wallet" />} className="mt-8">
          Return to Wallet
        </Button>
      </div>
    </div>
  );
}
