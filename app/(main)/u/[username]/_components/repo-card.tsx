import { Badge } from '@/components/ui/badge';
import type { GitHubRepo } from '@/lib/github/repo';
import Link from 'next/link';

interface RepoCardProps {
  repo: GitHubRepo;
  imported: boolean;
  openBountyCount: number;
  totalBountyValue: number;
  projectId?: string;
  isOwnProfile: boolean;
}

/**
 * RepoCard - Display a GitHub repository with BountyLane bounty overlay
 *
 * All repos link to BountyLane's permissionless repo viewer (/{owner}/{repo})
 * which fetches from GitHub API and overlays bounty data.
 */
export function RepoCard({
  repo,
  imported,
  openBountyCount,
  totalBountyValue,
  isOwnProfile,
}: RepoCardProps) {
  // Always link to BountyLane's permissionless repo viewer
  const href = `/${repo.owner.login}/${repo.name}`;

  return (
    <Link href={href} className="group block">
      <div className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-muted-foreground/50">
        {/* Repo name & description */}
        <h3 className="font-medium truncate group-hover:text-muted-foreground transition-colors">
          {repo.name}
        </h3>
        {repo.description && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{repo.description}</p>
        )}

        {/* Language & stars */}
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          {repo.language && <span>{repo.language}</span>}
          {repo.stargazers_count > 0 && <span>⭐ {repo.stargazers_count}</span>}
        </div>

        {/* BountyLane overlay: Show bounty info if imported */}
        {imported && openBountyCount > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {openBountyCount} open {openBountyCount === 1 ? 'bounty' : 'bounties'}
              </span>
              {totalBountyValue > 0 && (
                <span className="text-sm font-semibold text-success">
                  ${totalBountyValue.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Show "Create bounty" badge for non-imported repos (own profile only) */}
        {!imported && isOwnProfile && (
          <div className="mt-3 pt-3 border-t border-border">
            <Badge variant="outline" className="text-xs">
              Create bounty →
            </Badge>
          </div>
        )}
      </div>
    </Link>
  );
}
