'use client';

import { useMemo } from 'react';
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from '@/components/ui/item';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Badge } from '@/components/ui/badge';
import { Folder, GitBranch } from 'lucide-react';
import Link from 'next/link';

export interface RepoItem {
  id: string | number;
  name: string;
  owner: string;
  description?: string | null;
  bountyCount?: number;
  hasBounties?: boolean;
}

interface RepositoriesTabProps {
  repos: RepoItem[];
  filter: string;
  searchQuery: string;
}

export function RepositoriesTab({ repos, filter, searchQuery }: RepositoriesTabProps) {
  const filteredRepos = useMemo(() => {
    let result = repos;

    // Apply filter
    if (filter === 'with_bounties') {
      result = result.filter((repo) => (repo.bountyCount ?? 0) > 0 || repo.hasBounties);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (repo) =>
          repo.name.toLowerCase().includes(query) ||
          repo.owner.toLowerCase().includes(query) ||
          repo.description?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [repos, filter, searchQuery]);

  if (filteredRepos.length === 0) {
    return (
      <Empty className="py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Folder strokeWidth={1.5} />
          </EmptyMedia>
          <EmptyTitle>No repositories yet</EmptyTitle>
          <EmptyDescription>
            {searchQuery
              ? 'Try adjusting your search query.'
              : filter === 'with_bounties'
                ? 'No repositories with bounties found.'
                : 'Repositories will appear here once connected.'}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ItemGroup className="gap-0">
      {filteredRepos.map((repo, index) => (
        <div key={repo.id}>
          {index > 0 && <ItemSeparator />}
          <Link href={`/${repo.owner}/${repo.name}`} className="block">
            <Item className="cursor-pointer py-3 transition-colors hover:bg-muted/50">
              <ItemMedia variant="icon" className="rounded-full bg-muted/50 p-2 text-muted-foreground">
                <GitBranch className="size-4" strokeWidth={2} />
              </ItemMedia>
              <ItemContent>
                <ItemTitle className="flex items-center justify-between">
                  <span className="truncate text-sm font-medium">
                    {repo.owner}/{repo.name}
                  </span>
                  {(repo.bountyCount ?? 0) > 0 && (
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {repo.bountyCount} {repo.bountyCount === 1 ? 'bounty' : 'bounties'}
                    </Badge>
                  )}
                </ItemTitle>
                {repo.description && (
                  <ItemDescription className="line-clamp-1 text-xs">
                    {repo.description}
                  </ItemDescription>
                )}
              </ItemContent>
            </Item>
          </Link>
        </div>
      ))}
    </ItemGroup>
  );
}
