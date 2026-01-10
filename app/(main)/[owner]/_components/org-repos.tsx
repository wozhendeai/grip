'use client';

import { FolderGit2 } from 'lucide-react';
import Link from 'next/link';
import { formatUnits } from 'viem';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

interface OrgRepo {
  id: bigint;
  owner: string;
  name: string;
  bountyCount: number;
  totalFunded: bigint;
}

interface OrgReposProps {
  repos: OrgRepo[];
  isMember: boolean;
  orgSlug: string;
}

export function OrgRepos({ repos, isMember, orgSlug }: OrgReposProps) {
  if (repos.length === 0) {
    return (
      <section id="repos">
        <Empty className="border-0 py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="h-10 w-10">
              <FolderGit2 strokeWidth={1.5} />
            </EmptyMedia>
            <EmptyTitle>No repositories on GRIP yet</EmptyTitle>
            {isMember && (
              <EmptyDescription>
                <Link href={`/${orgSlug}/settings`} className="text-primary hover:underline">
                  Add a repository →
                </Link>
              </EmptyDescription>
            )}
          </EmptyHeader>
        </Empty>
      </section>
    );
  }

  return (
    <section id="repos">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {repos.map((repo) => (
          <Link
            key={repo.id.toString()}
            href={`/${repo.owner}/${repo.name}`}
            className="group flex flex-col justify-between rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm"
          >
            <div>
              <div className="mb-3 flex items-start justify-between">
                <h3 className="font-semibold text-base group-hover:text-primary transition-colors truncate pr-2">
                  {repo.name}
                </h3>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider font-medium">
                    Bounties
                  </span>
                  <span className="font-mono font-medium">{repo.bountyCount}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider font-medium">
                    Funded
                  </span>
                  <span className="font-mono font-medium">
                    ${formatUnits(repo.totalFunded ?? 0n, 6)}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
