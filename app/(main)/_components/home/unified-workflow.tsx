'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface WorkflowStep {
  id: string;
  title: string;
  description: string;
}

const steps: WorkflowStep[] = [
  {
    id: 'fund',
    title: 'Attach bounties instantly',
    description:
      'Maintainers add a price tag to any GitHub issue. Contributors see the reward immediately.',
  },
  {
    id: 'settle',
    title: 'Trustless Settlement',
    description:
      'Funds are locked in smart contracts. Payout happens automatically when PRs are merged. Zero friction.',
  },
  {
    id: 'build',
    title: 'Reputation Building',
    description:
      'Build an on-chain resume of your contributions. Projects attract better talent, devs get better offers.',
  },
];

export function UnifiedWorkflow() {
  const [activeStep, setActiveStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  // Auto-advance when video ends
  useEffect(() => {
    const video = videoRefs.current[activeStep];
    if (!video) return;

    const handleEnded = () => {
      // Only advance if not paused - if paused during video end, wait for unpause
      if (!isPaused) {
        setActiveStep((prev) => (prev + 1) % steps.length);
      }
    };

    video.addEventListener('ended', handleEnded);
    return () => video.removeEventListener('ended', handleEnded);
  }, [activeStep, isPaused]);

  // Restart video when step changes
  useEffect(() => {
    const video = videoRefs.current[activeStep];
    if (video) {
      video.currentTime = 0;
      video.play();
    }
  }, [activeStep]);

  // Pause/play video based on hover state
  useEffect(() => {
    const video = videoRefs.current[activeStep];
    if (!video) return;

    if (isPaused) {
      video.pause();
    } else {
      video.play();
    }
  }, [isPaused, activeStep]);

  // Track video progress for the ring indicator
  useEffect(() => {
    const video = videoRefs.current[activeStep];
    if (!video) return;

    let animationId: number;

    const updateProgress = () => {
      if (video.duration && !Number.isNaN(video.duration)) {
        setProgress((video.currentTime / video.duration) * 100);
      }
      animationId = requestAnimationFrame(updateProgress);
    };

    // Reset progress when step changes
    setProgress(0);
    updateProgress();

    return () => cancelAnimationFrame(animationId);
  }, [activeStep]);

  // Handle manual interaction
  const handleStepClick = (index: number) => {
    if (index !== activeStep) {
      setActiveStep(index);
    }
    // Don't pause on click - only pause on hover
  };

  return (
    <section data-testid="unified-workflow" className="py-24 bg-card text-card-foreground overflow-hidden">
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
                    data-testid={`workflow-step-${step.id}`}
                    data-active={isActive}
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
                            {/* Circular progress ring - driven by video currentTime */}
                            <svg data-testid="progress-ring" className="absolute inset-0 w-10 h-10 -rotate-90" aria-hidden="true">
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
                                className="text-primary"
                                style={{
                                  strokeDasharray: '113.1',
                                  strokeDashoffset: 113.1 - (113.1 * progress) / 100,
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
                data-testid={`workflow-video-${step.id}`}
                ref={(el) => { videoRefs.current[index] = el; }}
                src={`/videos/${step.id === 'fund' ? 'fund-bounty' : step.id === 'settle' ? 'passkey-wallet' : 'auto-payout'}.mp4`}
                className={cn(
                  'absolute inset-0 w-full h-full object-cover transition-opacity duration-500',
                  activeStep === index ? 'opacity-100' : 'opacity-0'
                )}
                autoPlay
                muted
                playsInline
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

