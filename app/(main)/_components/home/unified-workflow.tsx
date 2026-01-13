'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  duration: number; // milliseconds - matches video length
}

const steps: WorkflowStep[] = [
  {
    id: 'fund',
    title: 'Attach bounties instantly',
    description:
      'Maintainers add a price tag to any GitHub issue. Contributors see the reward immediately.',
    duration: 10000, // 10s - matches fund-bounty.mp4
  },
  {
    id: 'settle',
    title: 'Trustless Settlement',
    description:
      'Funds are locked in smart contracts. Payout happens automatically when PRs are merged. Zero friction.',
    duration: 12000, // 12s - matches passkey-wallet.mp4
  },
  {
    id: 'build',
    title: 'Reputation Building',
    description:
      'Build an on-chain resume of your contributions. Projects attract better talent, devs get better offers.',
    duration: 12000, // 12s - matches auto-payout.mp4
  },
];

export function UnifiedWorkflow() {
  const [activeStep, setActiveStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  // Auto-play logic - uses each step's duration
  useEffect(() => {
    if (isPaused) return;

    const currentDuration = steps[activeStep].duration;
    timerRef.current = setTimeout(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
      setAnimationKey((k) => k + 1);
    }, currentDuration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPaused, activeStep]);

  // Restart video when step changes
  useEffect(() => {
    const video = videoRefs.current[activeStep];
    if (video) {
      video.currentTime = 0;
      video.play();
    }
  }, [activeStep]);

  // Handle manual interaction
  const handleStepClick = (index: number) => {
    if (index !== activeStep) {
      setActiveStep(index);
      setAnimationKey((k) => k + 1);
    }
    // Don't pause on click - only pause on hover
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
                    <div className="flex gap-6">
                      <div className="mt-1 relative flex h-10 w-10 shrink-0 items-center justify-center">
                        {isActive ? (
                          <>
                            {/* Circular progress ring - key resets animation */}
                            <svg key={animationKey} className="absolute inset-0 w-10 h-10 -rotate-90" aria-hidden="true">
                              <circle
                                cx="20"
                                cy="20"
                                r="18"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="text-primary/20"
                              />
                              <circle
                                cx="20"
                                cy="20"
                                r="18"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                className={cn(
                                  'text-primary',
                                  !isPaused && 'animate-progress-ring'
                                )}
                                style={{
                                  strokeDasharray: '113.1',
                                  animationDuration: `${step.duration}ms`,
                                }}
                              />
                            </svg>
                            {/* Pause icon */}
                            <div className="flex gap-0.5">
                              <div className="w-1 h-3 bg-primary rounded-sm" />
                              <div className="w-1 h-3 bg-primary rounded-sm" />
                            </div>
                          </>
                        ) : (
                          <>
                            {/* Play icon */}
                            <div
                              className={cn(
                                'flex h-10 w-10 items-center justify-center rounded-full border transition-colors',
                                'border-border text-muted-foreground group-hover:border-primary group-hover:text-primary'
                              )}
                            >
                              <svg
                                className="w-4 h-4 ml-0.5"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                aria-hidden="true"
                              >
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </div>
                          </>
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

          {/* Right Column: Video Demo */}
          <div className="relative aspect-video bg-muted/30 rounded-3xl border border-border overflow-hidden">
            {/* Video for each step */}
            {steps.map((step, index) => (
              <video
                key={step.id}
                ref={(el) => { videoRefs.current[index] = el; }}
                src={`/videos/${step.id === 'fund' ? 'fund-bounty' : step.id === 'settle' ? 'passkey-wallet' : 'auto-payout'}.mp4`}
                className={cn(
                  'absolute inset-0 w-full h-full object-cover transition-opacity duration-500',
                  activeStep === index ? 'opacity-100' : 'opacity-0'
                )}
                autoPlay
                loop
                muted
                playsInline
              />
            ))}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes progress-ring {
          from { stroke-dashoffset: 113.1; }
          to { stroke-dashoffset: 0; }
        }
        .animate-progress-ring {
          animation-name: progress-ring;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
        }
      `}</style>
    </section>
  );
}

