'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { FolderGit2, Plus } from 'lucide-react';
import Link from 'next/link';
import type { ActiveRepo } from '@/db/queries/bounties';
import { AddRepoModal } from './add-repo-modal';

type RepositoriesCardProps = {
  repos: ActiveRepo[];
};

export function RepositoriesCard({ repos }: RepositoriesCardProps) {
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-muted-foreground">Repositories</h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 rounded-sm"
          onClick={() => setShowAddModal(true)}
        >
          <Plus className="size-3.5" />
        </Button>
      </div>
      <div className="space-y-1">
        {repos.length === 0 ? (
          <Empty className="border-0 p-4">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderGit2 className="size-4" />
              </EmptyMedia>
              <EmptyTitle>No repositories</EmptyTitle>
              <EmptyDescription>Connect a repo to get started</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          repos.map((repo) => (
            <Button
              key={repo.githubRepoId}
              variant="ghost"
              className="w-full justify-start gap-2 h-9 px-2 text-sm font-normal text-muted-foreground hover:text-foreground"
              nativeButton={false}
              render={<Link href={`/${repo.githubOwner}/${repo.githubRepo}`} />}
            >
              <div className="size-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold uppercase">
                {repo.githubOwner[0]}
              </div>
              {repo.githubFullName}
            </Button>
          ))
        )}
      </div>
      <AddRepoModal open={showAddModal} onOpenChange={setShowAddModal} />
    </div>
  );
}
