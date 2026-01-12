'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import type { OrgDashboardRepo } from '@/db/queries/org-dashboard';

interface OrgReposNavProps {
  repos: OrgDashboardRepo[];
  orgSlug: string;
}

export function OrgReposNav({ repos, orgSlug }: OrgReposNavProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-muted-foreground">Repositories</h3>
        <Button variant="ghost" size="icon-sm" className="rounded-sm" nativeButton={false} render={<Link href={`/${orgSlug}/settings/github`} title="Add repository" />}>
          <Plus className="size-3.5" />
        </Button>
      </div>

      {repos.length === 0 ? (
        <p className="text-xs text-muted-foreground px-2">No repositories yet.</p>
      ) : (
        <div className="space-y-1">
          {repos.map((repo) => (
            <Button
              key={repo.id.toString()}
              variant="ghost"
              className="w-full justify-start gap-2 h-9 px-2 text-sm font-normal text-muted-foreground hover:text-foreground"
              nativeButton={false}
              render={<Link href={`/${repo.owner}/${repo.name}`} />}
            >
              <div className="size-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">
                {repo.name.charAt(0).toUpperCase()}
              </div>
              <span className="truncate">
                {repo.owner}/{repo.name}
              </span>
              {repo.bountyCount > 0 && (
                <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5">
                  {repo.bountyCount}
                </Badge>
              )}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
