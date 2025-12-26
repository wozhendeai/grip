import { GitHubRepoCard } from '@/components/github/repo-card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from '@/components/ui/empty';
import { fetchGitHubUserRepositories } from '@/lib/github';
import { FolderGit2 } from 'lucide-react';

interface ProjectsSectionProps {
  username: string; // GitHub username (for API)
  userId: string | null; // GRIP user ID (for database overlay)
  isOwnProfile?: boolean;
}

/**
 * Projects section for user profile
 *
 * Displays ALL GitHub repositories (fetched from GitHub API)
 * Overlays GRIP bounty data for imported projects.
 *
 * Pattern: GitHub API first + database overlay
 * - Works for any GitHub user (signed up or not)
 * - Shows bounty counts for imported repos
 * - No "import" required just to see projects
 */
export async function ProjectsSection({
  username,
  userId,
  isOwnProfile = false,
}: ProjectsSectionProps) {
  // 1. Fetch GitHub repos (works for everyone)
  const githubRepos = await fetchGitHubUserRepositories(username, {
    sort: 'updated',
    perPage: 30,
  });

  // 2. Map repos for display (simplified - no bounty stats overlay for now)
  const repos = githubRepos.map((repo) => ({
    githubRepo: repo,
    imported: false,
    openBountyCount: 0,
    totalBountyValue: 0,
    projectId: undefined,
  }));

  return (
    <section className="py-8 border-b border-border">
      <div className="container">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground flex items-center gap-2">
          <FolderGit2 className="h-4 w-4" />
          Repositories ({repos.length})
        </h2>

        {repos.length === 0 ? (
          <Empty className="border-border bg-card/50">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderGit2 />
              </EmptyMedia>
              <EmptyDescription>No public repositories</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {repos.map(({ githubRepo, imported, openBountyCount, totalBountyValue }) => (
              <GitHubRepoCard
                key={githubRepo.id}
                repo={githubRepo}
                href={`/${githubRepo.owner.login}/${githubRepo.name}`}
                bounty={
                  openBountyCount > 0
                    ? { openCount: openBountyCount, totalValue: totalBountyValue }
                    : undefined
                }
                showCreateBountyCta={isOwnProfile && !imported}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
