import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export function DualAudiencePaths() {
  return (
    <section className="py-24 border-b border-border/50">
      <div className="container">
        <div className="grid gap-8 md:grid-cols-2 lg:gap-12">
          {/* For Funders */}
          <div className="group relative overflow-hidden rounded-3xl border border-border bg-card p-1">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

            <div className="relative flex h-full flex-col justify-between rounded-2xl bg-card/50 p-8 md:p-12 backdrop-blur-sm">
              <div>
                <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  {/* Building2 icon placeholder */}
                </div>
                <h3 className="mb-4 text-3xl font-bold tracking-tight text-foreground">
                  For Organizations
                </h3>
                <p className="mb-8 text-lg text-muted-foreground">
                  Turn your backlog into completed features. Fund issues with crypto, attract top
                  talent, and only pay for merged code.
                </p>

                <ul className="mb-8 space-y-4">
                  <li className="flex items-start gap-3 text-muted-foreground">
                    <span className="mt-1 h-5 w-5 text-primary shrink-0" />
                    <span>Pay only when PRs are approved</span>
                  </li>
                  <li className="flex items-start gap-3 text-muted-foreground">
                    <span className="mt-1 h-5 w-5 text-primary shrink-0" />
                    <span>Automated payments via smart contracts</span>
                  </li>
                </ul>
              </div>

              <Link
                href="/login"
                className={cn(buttonVariants({ variant: 'outline' }), 'w-full sm:w-auto')}
              >
                Create a Bounty
              </Link>
            </div>
          </div>

          {/* For Contributors */}
          <div className="group relative overflow-hidden rounded-3xl border border-border bg-card p-1">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

            <div className="relative flex h-full flex-col justify-between rounded-2xl bg-card/50 p-8 md:p-12 backdrop-blur-sm">
              <div>
                <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  {/* Code2 icon placeholder */}
                </div>
                <h3 className="mb-4 text-3xl font-bold tracking-tight text-foreground">
                  For Contributors
                </h3>
                <p className="mb-8 text-lg text-muted-foreground">
                  Get paid to write open source code. Solve real problems, earn crypto instantly,
                  and build your on-chain reputation.
                </p>

                <ul className="mb-8 space-y-4">
                  <li className="flex items-start gap-3 text-muted-foreground">
                    <span className="mt-1 h-5 w-5 text-primary shrink-0" />
                    <span>Instant settlement, no gas fees</span>
                  </li>
                  <li className="flex items-start gap-3 text-muted-foreground">
                    <span className="mt-1 h-5 w-5 text-primary shrink-0" />
                    <span>Guaranteed liquidity in escrow</span>
                  </li>
                </ul>
              </div>

              <Link
                href="/explore"
                className={cn(buttonVariants({ variant: 'outline' }), 'w-full sm:w-auto')}
              >
                Find Bounties
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
