import { Button, buttonVariants } from '@/components/ui/button';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-white/5 py-24 md:py-32 lg:py-40">
      {/* Background Gradients/Effects */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background opacity-40" />
      <div className="absolute inset-0 -z-10 h-full w-full bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

      <div className="container relative z-10 flex flex-col items-center text-center">
        <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary mb-8 backdrop-blur-sm">
          <span>v2.0 is live on Tempo Testnet</span>
        </div>

        <h1 className="max-w-4xl text-5xl font-bold tracking-tight md:text-6xl lg:text-7xl">
          Fund open source,
          <br />
          <span className="text-muted-foreground">get paid instantly.</span>
        </h1>

        <p className="mt-8 max-w-2xl text-lg text-muted-foreground md:text-xl leading-relaxed">
          The bounty platform for reliable payouts. Organizations fund issues, contributors solve
          them, and smart contracts handle the rest. Zero friction.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-center">
          <Button
            size="lg"
            className="h-12 px-8 text-base shadow-[0_0_20px_-5px_var(--color-primary)] hover:shadow-[0_0_25px_-5px_var(--color-primary)] transition-shadow duration-300"
            nativeButton={false}
            render={<Link href="/login">Start Funding</Link>}
          />
          <Button
            variant="outline"
            size="lg"
            className="h-12 px-8 text-base backdrop-blur-sm bg-background/50 hover:bg-background/80"
            nativeButton={false}
            render={<Link href="/explore">Explore Bounties</Link>}
          />
        </div>
      </div>
    </section>
  );
}
