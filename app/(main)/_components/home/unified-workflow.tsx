'use client';

import { useState, useEffect, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  GitPullRequest,
  Zap,
  ShieldCheck,
  ArrowRight,
  Wallet,
  Users,
  LayoutDashboard,
} from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import Link from 'next/link';

interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

const steps: WorkflowStep[] = [
  {
    id: 'fund',
    title: 'Attach bounties instantly',
    description:
      'Maintainers add a price tag to any GitHub issue. Contributors see the reward immediately.',
    icon: LayoutDashboard,
  },
  {
    id: 'settle',
    title: 'Trustless Settlement',
    description:
      'Funds are locked in smart contracts. Payout happens automatically when PRs are merged. Zero friction.',
    icon: ShieldCheck,
  },
  {
    id: 'build',
    title: 'Reputation Building',
    description:
      'Build an on-chain resume of your contributions. Projects attract better talent, devs get better offers.',
    icon: Users,
  },
];

export function UnifiedWorkflow() {
  const [activeStep, setActiveStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const stepDuration = 5000; // 5 seconds per step
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-play logic
  useEffect(() => {
    if (isPaused) return;

    timerRef.current = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, stepDuration);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused]);

  // Handle manual interaction
  const handleStepClick = (index: number) => {
    setActiveStep(index);
    // Optional: Pause on manual interaction to let user read
    setIsPaused(true);
  };

  return (
    <section className="py-24 bg-card text-card-foreground overflow-hidden">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Left Column: Header + Interactive Steps */}
          <div>
            <div className="mb-6 md:max-w-2xl">
              <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
                A unified workflow for everyone
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Whether you're funding a feature request or fixing a bug, GRIP streamlines the
                process. No more dual platforms—just one ecosystem where value flows directly to
                value creators.
              </p>
            </div>

            <div className="space-y-4">
              {steps.map((step, index) => {
                const isActive = activeStep === index;
                return (
                  <button
                    type="button"
                    key={step.id}
                    onClick={() => handleStepClick(index)}
                    className={cn(
                      'group relative cursor-pointer rounded-2xl p-6 transition-all duration-500 text-left w-full',
                      isActive ? 'bg-muted/50' : 'hover:bg-muted/30'
                    )}
                    onMouseEnter={() => setIsPaused(true)}
                    onMouseLeave={() => setIsPaused(false)}
                  >
                    {/* Progress Bar for Active Step */}
                    {isActive && !isPaused && (
                      <div className="absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-primary/20 overflow-hidden">
                        <div
                          className="h-full w-full bg-primary origin-top animate-progress"
                          style={{ animationDuration: `${stepDuration}ms` }}
                        />
                      </div>
                    )}

                    <div className="flex gap-6">
                      <div
                        className={cn(
                          'mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors',
                          isActive
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border text-muted-foreground'
                        )}
                      >
                        {isActive ? (
                          <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                        ) : (
                          <div className="h-2 w-2 rounded-full bg-current" />
                        )}
                      </div>

                      <div>
                        <h3
                          className={cn(
                            'text-xl font-bold transition-colors mb-2',
                            isActive
                              ? 'text-foreground'
                              : 'text-muted-foreground group-hover:text-foreground'
                          )}
                        >
                          {step.title}
                        </h3>
                        <p
                          className={cn(
                            'transition-all duration-500',
                            isActive
                              ? 'text-muted-foreground max-h-40 opacity-100'
                              : 'text-muted-foreground/50 max-h-0 opacity-0 overflow-hidden lg:max-h-40 lg:opacity-100'
                          )}
                        >
                          <span
                            className={cn(
                              isActive ? 'text-muted-foreground' : 'text-muted-foreground/60'
                            )}
                          >
                            {step.description}
                          </span>
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Visualizer */}
          <div className="relative aspect-square md:aspect-[4/3] lg:aspect-square bg-muted/30 rounded-3xl border border-border p-8 flex items-center justify-center overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent opacity-50" />
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)',
                backgroundSize: '24px 24px',
                opacity: 0.1,
              }}
            />

            {/* Connecting Lines */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-64 bg-gradient-to-b from-transparent via-border to-transparent" />

            {/* Nodes Container */}
            <div className="relative z-10 flex flex-col items-center gap-12 w-full max-w-sm">
              {/* Node 1: Funder */}
              <StepNode
                active={activeStep === 0}
                icon={Wallet}
                label="Funder"
                sublabel="Fund Issue 492"
                position="top"
              />

              {/* Center Node: GRIP */}
              <div
                className={cn(
                  'relative flex h-24 w-24 items-center justify-center rounded-3xl border bg-background/80 backdrop-blur-xl transition-all duration-700 shadow-xl',
                  activeStep === 1
                    ? 'border-primary shadow-[0_0_30px_-10px_var(--color-primary)] scale-110'
                    : 'border-border'
                )}
              >
                <div className="absolute inset-0 bg-primary/5 rounded-3xl animate-pulse" />
                <div className="text-center">
                  <Zap
                    className={cn(
                      'h-8 w-8 mx-auto mb-1 transition-colors duration-500',
                      activeStep === 1 ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />
                  <div className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
                    GRIP
                  </div>
                </div>
              </div>

              {/* Node 3: Contributor */}
              <StepNode
                active={activeStep === 2}
                icon={GitPullRequest}
                label="Contributor"
                sublabel="Merge PR 105"
                position="bottom"
              />
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes progress {
          from { transform: scaleY(0); }
          to { transform: scaleY(1); }
        }
        .animate-progress {
          animation-name: progress;
          animation-timing-function: linear;
        }
      `}</style>
    </section>
  );
}

function StepNode({
  active,
  icon: Icon,
  label,
  sublabel,
  position,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  sublabel: string;
  position: 'top' | 'bottom';
}) {
  return (
    <div
      className={cn(
        'relative flex items-center gap-4 rounded-2xl border bg-background/80 px-6 py-4 transition-all duration-700 w-64 backdrop-blur-md',
        active
          ? 'border-primary/50 translate-y-0 opacity-100 shadow-lg shadow-primary/5'
          : 'border-border opacity-40 grayscale',
        !active && position === 'top' && '-translate-y-4',
        !active && position === 'bottom' && 'translate-y-4'
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-lg bg-muted transition-colors',
          active ? 'text-primary bg-primary/10' : 'text-muted-foreground'
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </div>
        <div
          className={cn(
            'text-sm font-bold transition-colors',
            active ? 'text-foreground' : 'text-muted-foreground'
          )}
        >
          {sublabel}
        </div>
      </div>

      {/* Active Indicator Dot */}
      {active && (
        <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-primary shadow-[0_0_10px_var(--color-primary)]" />
      )}
    </div>
  );
}
