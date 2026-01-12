'use client';

import { GitBranch, Zap } from 'lucide-react';
import Link from 'next/link';
import { formatUnits } from 'viem';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  description?: string | null;
  language?: string | null;
  languageColor?: string | null;
  bountyCount: number;
  totalFunded: bigint;
}

interface OrgReposProps {
  repos: OrgRepo[];
  isMember: boolean;
  orgSlug: string;
}

function formatCurrency(amount: bigint): string {
  const dollars = Number(formatUnits(amount, 6));
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(dollars);
}

export function OrgRepos({ repos, isMember, orgSlug }: OrgReposProps) {
  if (repos.length === 0) {
    return (
      <Empty className="border-0 py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="h-10 w-10 text-muted-foreground/30">
            <GitBranch strokeWidth={1.5} />
          </EmptyMedia>
          <EmptyTitle className="text-sm font-normal text-muted-foreground">
            No repositories connected yet.
          </EmptyTitle>
          {isMember && (
            <EmptyDescription>
              <Link href={`/${orgSlug}/settings`} className="text-primary hover:underline">
                Add a repository →
              </Link>
            </EmptyDescription>
          )}
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {repos.map((repo) => (
        <Link key={repo.id.toString()} href={`/${repo.owner}/${repo.name}`}>
          <Card className="h-full hover:border-primary/30 transition-colors cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {orgSlug}/{repo.name}
              </CardTitle>
              {repo.description && (
                <CardDescription className="text-xs line-clamp-2">
                  {repo.description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {repo.language && (
                    <>
                      <div
                        className="size-2 rounded-full"
                        style={{ backgroundColor: repo.languageColor || '#6e7681' }}
                      />
                      <span>{repo.language}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {repo.bountyCount > 0 && (
                    <Badge variant="secondary" className="gap-1">
                      <Zap className="size-3 text-amber-500" strokeWidth={2} />
                      {repo.bountyCount}
                    </Badge>
                  )}
                  <span className="font-mono text-green-600">
                    {formatCurrency(repo.totalFunded)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
