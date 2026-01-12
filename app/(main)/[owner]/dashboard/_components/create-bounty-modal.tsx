'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { GitBranch, Search, ExternalLink } from 'lucide-react';
import type { OrgDashboardRepo } from '@/db/queries/org-dashboard';

interface CreateBountyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repos: OrgDashboardRepo[];
  orgSlug: string;
}

export function CreateBountyModal({ open, onOpenChange, repos, orgSlug }: CreateBountyModalProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const filteredRepos = repos.filter((repo) =>
    `${repo.owner}/${repo.name}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectRepo = (repo: OrgDashboardRepo) => {
    onOpenChange(false);
    router.push(`/${repo.owner}/${repo.name}/bounties/new`);
  };

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open);
    if (!open) {
      setSearch('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Bounty</DialogTitle>
          <DialogDescription>Select a repository to create a bounty on.</DialogDescription>
        </DialogHeader>

        {repos.length === 0 ? (
          <div className="py-8 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted mx-auto mb-3">
              <GitBranch className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              No repositories with bounties yet.
            </p>
            <a
              href={`https://github.com/orgs/${orgSlug}/repositories`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
            >
              <ExternalLink className="size-3.5" />
              Browse GitHub Repos
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {repos.length > 5 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search repositories..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            )}

            <div className="max-h-[300px] overflow-y-auto -mx-1 px-1">
              {filteredRepos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No repositories match your search.
                </p>
              ) : (
                <div className="space-y-1">
                  {filteredRepos.map((repo) => (
                    <Button
                      key={repo.id.toString()}
                      variant="ghost"
                      className="w-full justify-start h-auto py-3 px-3"
                      onClick={() => handleSelectRepo(repo)}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <div className="size-8 rounded-md bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                          {repo.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-sm font-medium truncate">
                            {repo.owner}/{repo.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {repo.bountyCount} {repo.bountyCount === 1 ? 'bounty' : 'bounties'}
                          </p>
                        </div>
                        {repo.bountyCount > 0 && (
                          <Badge variant="secondary" className="text-[10px] shrink-0">
                            {repo.bountyCount}
                          </Badge>
                        )}
                      </div>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
