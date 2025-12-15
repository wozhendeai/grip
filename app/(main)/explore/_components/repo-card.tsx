import { formatTokenAmount } from '@/lib/types';
import Link from 'next/link';

/**
 * RepoCard - Card component for displaying a repository with bounty stats
 *
 * Design decision: Clean card layout matching MeritSystems top repos section.
 * Shows repo name, total bounty value (highlighted in green), and bounty count.
 * Links to project page (future) or explore with repo filter.
 */

export interface TopRepo {
  id: string;
  githubOwner: string;
  githubRepo: string;
  githubFullName: string;
  totalBountyValue: number;
  openBountyCount: number;
}

interface RepoCardProps {
  repo: TopRepo;
}

export function RepoCard({ repo }: RepoCardProps) {
  return (
    <Link
      href={`/explore?repo=${repo.githubFullName}`}
      className="group flex flex-col rounded-lg border border-border bg-card p-6 transition-colors hover:border-muted-foreground"
    >
      {/* Repo Avatar + Name */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-xs font-bold uppercase">
          {repo.githubOwner.slice(0, 2)}
        </div>
        <span className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
          {repo.githubFullName}
        </span>
      </div>

      {/* Total Bounty Value */}
      <div className="mb-2">
        <span className="text-2xl font-bold text-success">
          {formatTokenAmount(repo.totalBountyValue)}
        </span>
      </div>

      {/* Bounty Count */}
      <div className="text-sm text-muted-foreground">
        {repo.openBountyCount} open {repo.openBountyCount === 1 ? 'bounty' : 'bounties'}
      </div>
    </Link>
  );
}

export function RepoCardSkeleton() {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="h-10 w-10 animate-pulse rounded-lg bg-muted" />
        <div className="h-5 w-32 animate-pulse rounded bg-muted" />
      </div>
      <div className="mb-2 h-8 w-24 animate-pulse rounded bg-muted" />
      <div className="h-4 w-20 animate-pulse rounded bg-muted" />
    </div>
  );
}
