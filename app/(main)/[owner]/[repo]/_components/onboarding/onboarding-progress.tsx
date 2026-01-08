'use client';

import { cn } from '@/lib/utils';

interface OnboardingProgressProps {
  current: number;
  total: number;
}

export function OnboardingProgress({ current, total }: OnboardingProgressProps) {
  // Generate array of step numbers [1, 2, 3, 4] for stable keys
  const steps = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <div className="flex justify-center gap-2 mb-6">
      {steps.map((step) => (
        <div
          key={step}
          className={cn(
            'h-2 w-2 rounded-full transition-colors',
            step === current ? 'bg-primary' : step < current ? 'bg-primary/50' : 'bg-muted'
          )}
        />
      ))}
    </div>
  );
}
