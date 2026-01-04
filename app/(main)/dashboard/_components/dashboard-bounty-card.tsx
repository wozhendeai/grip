import { BountyStatus } from '@/components/bounty/bounty-status';
import { Button } from '@/components/ui/button';
import type { Bounty } from '@/lib/types';
import { CheckCircle, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { SerializedSubmission } from './dashboard-client';

type CardVariant = 'created' | 'claimed' | 'completed';

interface DashboardBountyCardProps {
  bounty: Bounty;
  variant: CardVariant;
  submission?: SerializedSubmission;
  submissionCount?: number;
  activeSubmissionCount?: number;
  payout?: {
    id: string;
    amount: string;
    confirmedAt: string | null;
    txHash: string | null;
  } | null;
}

/**
 * Context-aware bounty card for dashboard
 * Shows different actions and info based on variant (created, claimed, completed)
 */
export function DashboardBountyCard({
  bounty,
  variant,
  submission,
  submissionCount = 0,
  activeSubmissionCount = 0,
  payout,
}: DashboardBountyCardProps) {
  // Format amount from micro-units (6 decimals) to display
  const amountInUsdc = bounty.totalFunded
    ? Number(BigInt(bounty.totalFunded) / BigInt(1_000_000))
    : null;
  const bountyUrl = `/${bounty.githubOwner}/${bounty.githubRepo}/bounty/${bounty.id}`;

  // Get display labels (max 2)
  const labels = bounty.labels ?? [];
  const displayLabels = labels.slice(0, 2);
  const remainingCount = labels.length > 2 ? labels.length - 2 : 0;

  return (
    <article className="space-y-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-muted-foreground/50">
      {/* Header: Repo + Status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold uppercase text-muted-foreground">
            {bounty.githubOwner.slice(0, 2)}
          </div>
          <div className="min-w-0">
            <div className="text-sm text-muted-foreground">
              {bounty.project.githubFullName} · #{bounty.githubIssueNumber}
            </div>
          </div>
        </div>
        <div className="shrink-0 text-lg font-semibold text-success">
          {amountInUsdc !== null ? `$${amountInUsdc.toLocaleString()}` : 'Hidden'}
        </div>
      </div>

      {/* Title */}
      <h3 className="line-clamp-2 font-semibold text-foreground">{bounty.title}</h3>

      {/* Labels */}
      {displayLabels.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {displayLabels.map((label) => (
            <span
              key={label.id}
              className="rounded-md px-2.5 py-1 text-xs font-medium"
              style={{
                backgroundColor: `#${label.color}20`,
                color: `#${label.color}`,
              }}
            >
              {label.name}
            </span>
          ))}
          {remainingCount > 0 && (
            <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              +{remainingCount}
            </span>
          )}
        </div>
      )}

      {/* Variant-specific action section */}
      {variant === 'created' && (
        <CreatedVariantSection
          bounty={bounty}
          bountyUrl={bountyUrl}
          submissionCount={submissionCount}
          activeSubmissionCount={activeSubmissionCount}
        />
      )}

      {variant === 'claimed' && submission && <ClaimedVariantSection submission={submission} />}

      {variant === 'completed' && submission && (
        <CompletedVariantSection submission={submission} payout={payout} />
      )}
    </article>
  );
}

/**
 * Created variant: Shows submission count and Manage button
 */
function CreatedVariantSection({
  bounty,
  bountyUrl,
  submissionCount,
  activeSubmissionCount,
}: {
  bounty: Bounty;
  bountyUrl: string;
  submissionCount: number;
  activeSubmissionCount: number;
}) {
  const submissionText =
    submissionCount === 0
      ? 'No submissions yet'
      : activeSubmissionCount === 1
        ? '1 active submission'
        : `${activeSubmissionCount} active submissions`;

  return (
    <div className="border-t border-border pt-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{submissionText}</span>
        <BountyStatus status={bounty.status as 'open' | 'completed' | 'cancelled'} />
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        nativeButton={false}
        render={<Link href={bountyUrl} />}
      >
        Manage Bounty
      </Button>
    </div>
  );
}

/**
 * Claimed variant: Shows PR info and View PR button
 */
function ClaimedVariantSection({ submission }: { submission: SerializedSubmission }) {
  const submittedAt = submission.submittedAt ? formatTimeAgo(submission.submittedAt) : 'Recently';

  return (
    <div className="border-t border-border pt-3">
      <div className="mb-2">
        <div className="text-xs text-muted-foreground">
          PR #{submission.githubPrNumber} · {submittedAt}
        </div>
        {submission.funderApprovedAt && (
          <div className="mt-1 flex items-center gap-1 text-xs text-success">
            <CheckCircle className="h-3 w-3" />
            Approved
          </div>
        )}
      </div>
      {submission.githubPrUrl && (
        <a
          href={submission.githubPrUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          View PR
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

/**
 * Completed variant: Shows payout info and transaction link
 */
function CompletedVariantSection({
  submission,
  payout,
}: {
  submission: SerializedSubmission;
  payout?: {
    id: string;
    amount: string;
    confirmedAt: string | null;
    txHash: string | null;
  } | null;
}) {
  const paidAt = payout?.confirmedAt ? formatDate(payout.confirmedAt) : 'Recently';

  return (
    <div className="border-t border-border pt-3">
      <div className="mb-2">
        <div className="flex items-center gap-1 text-xs text-success">
          <CheckCircle className="h-3 w-3" />
          Paid on {paidAt}
        </div>
        {payout?.txHash && (
          <a
            href={`https://explorer.tempo.xyz/tx/${payout.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View transaction
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}

/**
 * Format a date string to relative time (e.g., "2 days ago")
 */
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

/**
 * Format a date string to display format (e.g., "Dec 24, 2025")
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
