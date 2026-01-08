import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CreatedBountyWithSubmissionCount } from '@/db/queries/bounties';
import { AlertCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface NeedsAttentionProps {
  createdBounties: CreatedBountyWithSubmissionCount[];
}

export function NeedsAttention({ createdBounties }: NeedsAttentionProps) {
  // Filter for bounties that have active submissions (pending review)
  // We only care about bounties where WE are the primary funder (which createdBounties already are)
  // and that have 'pending' submissions.
  // The `activeSubmissionCount` in the query includes pending, approved, merged.
  // Ideally, we'd want specifically 'pending' count, but we can assume if active > 0 and status is open, it might need attention.
  // Actually, let's look at the query: activeSubmissionCount is status in ('pending', 'approved', 'merged').
  // A 'pending' submission definitely needs attention.
  // An 'approved' one might be waiting for payout?
  // Let's assume for this MVP that any bounty with active submissions is worth looking at if you're the funder.
  // To be more precise, we'd want to know specifically about PENDING submissions.
  // The current query `activeSubmissionCount` doesn't split them.
  // However, `getBountiesCreatedByUser` returns `activeSubmissionCount`.

  const bountiesNeedingReview = createdBounties.filter(
    (item) => item.activeSubmissionCount > 0 && item.bounty.status === 'open'
  );

  if (bountiesNeedingReview.length === 0) {
    return null;
  }

  return (
    <Card className="border-chart-4/20 bg-chart-4/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-chart-4" />
          <CardTitle className="text-base font-semibold text-chart-4">Needs Attention</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {bountiesNeedingReview.slice(0, 3).map((item) => (
          <div
            key={item.bounty.id}
            className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 p-4"
          >
            <div className="space-y-1">
              <p className="font-medium leading-none">{item.bounty.title}</p>
              <p className="text-sm text-muted-foreground">
                {item.activeSubmissionCount} active{' '}
                {item.activeSubmissionCount === 1 ? 'submission' : 'submissions'}
              </p>
            </div>
            <Button
              render={
                <Link
                  href={`/${item.bounty.githubOwner}/${item.bounty.githubRepo}/bounties/${item.bounty.id}`}
                />
              }
              size="sm"
              variant="ghost"
              className="gap-2"
            >
              Review <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
