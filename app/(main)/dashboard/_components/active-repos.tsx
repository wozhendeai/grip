import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { FolderGit2 } from 'lucide-react';
import Link from 'next/link';

// Redefine locally to avoid server-side imports
export interface ActiveRepoItem {
  githubRepoId: string;
  githubOwner: string;
  githubRepo: string;
  githubFullName: string;
  openCount: number;
  totalFunded: string;
  lastActivity: {
    description: string;
    date: Date;
  } | null;
}

interface ActiveReposProps {
  repos: ActiveRepoItem[];
}

function timeAgo(date: Date) {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  let interval = seconds / 31536000;
  if (interval > 1) return `${Math.floor(interval)} years ago`;
  interval = seconds / 2592000;
  if (interval > 1) return `${Math.floor(interval)} months ago`;
  interval = seconds / 86400;
  if (interval > 1) return `${Math.floor(interval)} days ago`;
  interval = seconds / 3600;
  if (interval > 1) return `${Math.floor(interval)} hours ago`;
  interval = seconds / 60;
  if (interval > 1) return `${Math.floor(interval)} minutes ago`;
  return `${Math.floor(seconds)} seconds ago`;
}

export function ActiveRepos({ repos }: ActiveReposProps) {
  if (repos.length === 0) {
    return (
      <Card className="h-full border-border bg-card shadow-sm py-0 gap-0">
        <CardHeader className="border-b border-border bg-muted/40 py-3 px-4">
          <CardTitle className="text-base font-semibold">Repositories</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center p-4 min-h-[200px]">
          <Empty className="border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="h-10 w-10">
                <FolderGit2 strokeWidth={1.5} />
              </EmptyMedia>
              <EmptyTitle>No repositories</EmptyTitle>
              <EmptyDescription className="mb-4">
                You don&apos;t have any repositories connected yet.
              </EmptyDescription>
              <Button render={<Link href="/settings/repos" />} size="sm" variant="default">
                Connect Repository
              </Button>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full border-border bg-card shadow-sm flex flex-col py-0 gap-0">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border bg-muted/40 py-3 px-4">
        <CardTitle className="text-base font-semibold">Codespaces</CardTitle>
        <Link
          href="/settings/repos"
          className="text-xs text-muted-foreground hover:text-foreground flex items-center transition-colors"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent className="p-0 flex-1">
        {repos.map((repo) => (
          <div
            key={repo.githubRepoId}
            className="group flex flex-col gap-1 p-4 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <Link
                  href={`/${repo.githubOwner}/${repo.githubRepo}`}
                  className="font-semibold text-sm hover:text-primary transition-colors flex items-center gap-2"
                >
                  {repo.githubOwner} / {repo.githubRepo}
                </Link>
                <div className="text-xs text-muted-foreground mt-1">
                  {repo.lastActivity ? (
                    <span>
                      {repo.lastActivity.description} · {timeAgo(new Date(repo.lastActivity.date))}
                    </span>
                  ) : (
                    <span>No recent activity</span>
                  )}
                </div>
              </div>
              {/* Right side stats */}
              <div className="flex items-center gap-3">
                {Number(repo.totalFunded) > 0 && (
                  <div className="text-xs font-medium bg-success/10 text-success px-2 py-0.5 rounded-full border border-success/20">
                    ${Number(repo.totalFunded).toLocaleString()} funded
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {/* Fill empty space if few repos? No, keep it compact */}
      </CardContent>
    </Card>
  );
}
