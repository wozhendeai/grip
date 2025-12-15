import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Info } from 'lucide-react';

/**
 * StatCard - Reusable statistics display component
 *
 * Design decision: Using bordered card pattern from MeritSystems inspiration.
 * Info tooltip provides context without cluttering the UI.
 * Supports accent colors via valueClassName for highlighting amounts.
 */

interface StatCardProps {
  label: string;
  value: string | number;
  info?: string;
  valueClassName?: string;
  className?: string;
}

export function StatCard({ label, value, info, valueClassName, className }: StatCardProps) {
  return (
    <div className={cn('rounded-lg border border-border bg-card px-6 py-4', className)}>
      <div className="mb-1 flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        {info && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={`Info about ${label}`}
                  />
                }
              >
                <Info className="h-4 w-4" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{info}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div className={cn('text-2xl font-bold', valueClassName)}>{value}</div>
    </div>
  );
}
