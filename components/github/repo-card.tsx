'use client';

import Link from 'next/link';
import type { GitHubRepo } from '@/lib/github/api';
import { Badge } from '@/components/ui/badge';

interface GitHubRepoCardProps {
  repo: GitHubRepo;
  href: string;
  bounty?: {
    openCount: number;
    totalValue: number;
  };
  layout?: 'minimal' | 'full';
  showCreateBountyCta?: boolean;
}

/**
 * Unified GitHub repository card component
 *
 * Supports two layouts:
 * - minimal: Bounty-first design for explore/discovery (prominent bounty value)
 * - full: Balanced GitHub metadata + bounty overlay for profiles
 *
 * Hover behavior: Subtle background change only (no border/text color changes)
 * Design: Handles missing data gracefully (description, language, stars can be null)
 */
export function GitHubRepoCard({
  repo,
  href,
  bounty,
  layout = 'full',
  showCreateBountyCta = false,
}: GitHubRepoCardProps) {
  // Minimal layout: Bounty-first for explore page
  if (layout === 'minimal') {
    return (
      <Link href={href} className="group block">
        <div className="flex flex-col rounded-lg border border-border bg-card p-6 transition-colors hover:bg-muted">
          {/* Owner avatar + repo name */}
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-xs font-bold uppercase">
              {repo.owner.login.slice(0, 2)}
            </div>
            <span className="font-medium text-foreground truncate">{repo.full_name}</span>
          </div>

          {/* Bounty value (prominent if exists) */}
          {bounty && (
            <>
              <div className="mb-2">
                <span className="text-2xl font-bold text-success">
                  $
                  {bounty.totalValue.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                {bounty.openCount} open {bounty.openCount === 1 ? 'bounty' : 'bounties'}
              </div>
            </>
          )}
        </div>
      </Link>
    );
  }

  // Full layout: Balanced GitHub + bounty overlay
  return (
    <Link href={href} className="group block">
      <div className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted">
        {/* Repo name */}
        <h3 className="font-medium truncate">{repo.name}</h3>

        {/* Description */}
        {repo.description && (
          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{repo.description}</p>
        )}

        {/* Language & stars */}
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          {repo.language && <span>{repo.language}</span>}
          {repo.stargazers_count > 0 && <span>⭐ {repo.stargazers_count.toLocaleString()}</span>}
        </div>

        {/* Bounty overlay (if exists) */}
        {bounty && bounty.openCount > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {bounty.openCount} open {bounty.openCount === 1 ? 'bounty' : 'bounties'}
              </span>
              {bounty.totalValue > 0 && (
                <span className="text-sm font-semibold text-success">
                  ${bounty.totalValue.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Create bounty CTA (own profile only) */}
        {showCreateBountyCta && !bounty && (
          <div className="mt-4 pt-4 border-t border-border">
            <Badge variant="outline" className="text-xs">
              Create bounty →
            </Badge>
          </div>
        )}
      </div>
    </Link>
  );
}

/**
 * Skeleton loader for GitHubRepoCard
 * Matches the layout variant for consistent loading states
 */
export function GitHubRepoCardSkeleton({ layout = 'full' }: { layout?: 'minimal' | 'full' }) {
  if (layout === 'minimal') {
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

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card p-4">
      <div className="h-5 w-32 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-4 w-full animate-pulse rounded bg-muted" />
      <div className="mt-3 flex items-center gap-4">
        <div className="h-4 w-16 animate-pulse rounded bg-muted" />
        <div className="h-4 w-12 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
