import { Button } from '@/components/ui/button';
import Link from 'next/link';

/**
 * Footer CTA for dashboard
 * Encourages users to create more bounties
 */
export function DashboardFooterCTA() {
  return (
    <div className="container">
      <div className="flex flex-col items-center justify-between gap-4 rounded-xl bg-slate-50 p-6 dark:bg-slate-900 sm:flex-row">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">
            Want to fund more work?
          </h3>
          <p className="text-sm text-muted-foreground">Create a bounty on any GitHub issue</p>
        </div>
        <Button nativeButton={false} render={<Link href="/explore" />}>
          Explore Issues
        </Button>
      </div>
    </div>
  );
}
