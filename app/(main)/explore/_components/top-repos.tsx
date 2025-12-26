import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import Link from 'next/link';
import { TopRepoCard } from './top-repo-card';

export interface TopRepo {
  id: string;
  githubOwner: string;
  githubRepo: string;
  githubFullName: string;
  totalBountyValue: number;
  openBountyCount: number;
}

/**
 * TopRepos - Section showing repositories with highest total bounty values
 *
 * Server component: Receives repos as props from parent page (SSR).
 * No client-side fetching or loading states needed.
 *
 * Design decision: 3-column grid matching MeritSystems explore page.
 * Section header links to full repos listing (future).
 * Limited to 6 repos to maintain visual balance.
 */

interface TopReposProps {
  repos: TopRepo[];
}

export function TopRepos({ repos }: TopReposProps) {
  return (
    <section className="border-b border-border pb-8">
      <div className="container">
        {/* Section Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold">Top Repos</h2>
          <Link
            href="/projects"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            View all &rarr;
          </Link>
        </div>

        {/* Repos Grid */}
        {repos.length === 0 ? (
          <Empty className="border-border bg-card/50">
            <EmptyHeader>
              <EmptyTitle>No repos yet</EmptyTitle>
              <EmptyDescription>Projects with open bounties will appear here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {repos.map((repo) => (
              <TopRepoCard
                key={repo.id}
                repo={repo}
                href={`/${repo.githubOwner}/${repo.githubRepo}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
