'use client';

import type { GitHubOrganization } from '@/lib/github/organizations';
import type { GitHubRepo } from '@/lib/github/api';
import type { organization } from '@/db/schema/auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { BountyStatus } from '@/components/bounty/bounty-status';
import type { BountyStatus as BountyStatusType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ArrowRight, ExternalLink, FolderGit2, Github } from 'lucide-react';
import Link from 'next/link';
import { formatUnits } from 'viem';
import { EntityHeader } from './entity-header';
import { MemberAvatarGrid } from './member-avatar-grid';

interface OrgProfileProps {
  github: GitHubOrganization;
  repos: GitHubRepo[];
  gripOrg: typeof organization.$inferSelect | null;
  bountyData: {
    funded: Array<{
      id: string;
      title: string;
      amount: bigint;
      status: 'open' | 'completed' | 'cancelled';
      githubOwner: string;
      githubRepo: string;
      githubIssueNumber: number;
      createdAt: string | null;
    }>;
    totalFunded: bigint;
    fundedCount: number;
  } | null;
  members: Array<{
    id: string;
    role: string;
    user: {
      id: string;
      name: string;
      image: string | null;
    } | null;
  }> | null;
  isLoggedIn: boolean;
}

const statusStyles: Record<BountyStatusType, string> = {
  open: 'border-success/50 hover:border-success bg-success/5',
  completed: 'border-border hover:border-muted-foreground/50 bg-secondary/50',
  cancelled: 'border-destructive/50 hover:border-destructive bg-destructive/5',
};

/**
 * Organization profile component
 *
 * Shows GitHub org info with GRIP overlay if org is linked.
 * Uses section-based layout matching user profile design.
 */
export function OrgProfile({
  github,
  repos,
  gripOrg,
  bountyData,
  members,
  isLoggedIn,
}: OrgProfileProps) {
  console.log('[OrgProfile] Component render:', {
    orgLogin: github.login,
    hasGripOrg: !!gripOrg,
    hasBountyData: !!bountyData,
    membersProp: members,
    membersLength: members?.length ?? 0,
    membersCondition: {
      hasGripOrg: !!gripOrg,
      hasMembers: !!members,
      membersNotEmpty: members && members.length > 0,
      willRender: !!(gripOrg && members && members.length > 0),
    },
  });

  // Extract unique repos from bounties for REPOSITORIES section
  const uniqueRepos = new Set(
    bountyData?.funded.map((b) => `${b.githubOwner}/${b.githubRepo}`) || []
  );

  // Count completed bounties
  const completedCount = bountyData?.funded.filter((b) => b.status === 'completed').length || 0;

  return (
    <div className="min-h-screen">
      {/* Header Section */}
      <EntityHeader
        type="org"
        name={github.name || github.login}
        handle={github.login}
        avatar={github.avatar_url}
        description={github.description}
        isLinked={!!gripOrg}
        metadata={{
          secondary: (
            <>
              <a
                href={`https://github.com/${github.login}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <Github className="h-4 w-4" />
                <span>github.com/{github.login}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
              {members && members.length > 0 && (
                <>
                  <span className="mx-2 text-xs">·</span>
                  <span>
                    {members.length} {members.length === 1 ? 'member' : 'members'}
                  </span>
                </>
              )}
            </>
          ),
        }}
      />

      {/* GitHub repos section for unlinked orgs */}
      {!gripOrg && (
        <section className="container py-8">
          <h2 className="mb-4 text-sm font-medium text-muted-foreground">REPOSITORIES</h2>

          {repos.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {repos.slice(0, 30).map((repo) => (
                <Link
                  key={repo.id}
                  href={`/${repo.owner.login}/${repo.name}`}
                  className="block rounded-lg border border-border bg-card p-4 hover:border-muted-foreground/50 transition-colors"
                >
                  <h3 className="font-medium mb-1">{repo.name}</h3>
                  {repo.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {repo.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {repo.language && <span>{repo.language}</span>}
                    <span>★ {repo.stargazers_count}</span>
                    <span>⑂ {repo.forks_count}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <Empty className="border-border bg-card/50">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FolderGit2 />
                </EmptyMedia>
                <EmptyTitle>No public repositories</EmptyTitle>
              </EmptyHeader>
            </Empty>
          )}
        </section>
      )}

      {/* FUNDED Section */}
      {gripOrg && bountyData && (
        <section className="border-b border-border bg-card/30">
          <div className="container py-8">
            <div className="mb-6 flex items-baseline justify-between">
              <h2 className="text-sm font-medium text-muted-foreground">FUNDED</h2>
              <div className="text-right">
                <span className="text-2xl font-bold">
                  ${formatUnits(bountyData.totalFunded, 6)}
                </span>
                <p className="text-xs text-muted-foreground">
                  {bountyData.fundedCount} {bountyData.fundedCount === 1 ? 'bounty' : 'bounties'}{' '}
                  created · {completedCount} completed
                </p>
              </div>
            </div>

            {bountyData.funded.length > 0 ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {bountyData.funded.slice(0, 3).map((bounty) => (
                    <Link
                      key={bounty.id}
                      href={`/${bounty.githubOwner}/${bounty.githubRepo}/bounties/${bounty.id}`}
                      className={cn(
                        'group relative block rounded-lg border bg-card p-4 transition-all duration-200 hover:scale-[1.02]',
                        statusStyles[bounty.status as BountyStatusType]
                      )}
                    >
                      {/* Pulse indicator for active bounties */}
                      {bounty.status === 'open' && (
                        <div className="absolute -right-1 -top-1 h-2 w-2">
                          <div className="h-full w-full animate-pulse rounded-full bg-success" />
                        </div>
                      )}

                      {/* Status Badge */}
                      <div className="mb-2">
                        <BountyStatus status={bounty.status as BountyStatusType} />
                      </div>

                      {/* Repo Name */}
                      <code className="mb-2 block font-mono text-xs text-muted-foreground">
                        {bounty.githubOwner}/{bounty.githubRepo}
                      </code>

                      {/* Bounty Title */}
                      <h4 className="mb-3 font-medium transition-colors group-hover:text-muted-foreground line-clamp-2">
                        {bounty.title}
                      </h4>

                      {/* Amount and Arrow */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-mono text-lg font-bold text-foreground">
                            ${formatUnits(BigInt(bounty.amount), 6)}
                          </span>
                          <span className="ml-1 font-mono text-xs text-muted-foreground">USDC</span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                      </div>
                    </Link>
                  ))}
                </div>

                {bountyData.funded.length > 3 && (
                  <Link
                    href="/bounties"
                    className="mt-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    View all bounties
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No bounties yet</p>
            )}
          </div>
        </section>
      )}

      {/* REPOSITORIES Section */}
      {gripOrg && bountyData && uniqueRepos.size > 0 && (
        <section className="border-b border-border bg-card/30">
          <div className="container py-8">
            <h2 className="mb-4 text-sm font-medium text-muted-foreground">
              REPOSITORIES ({uniqueRepos.size})
            </h2>

            <div className="flex flex-wrap gap-2">
              {Array.from(uniqueRepos).map((repoFullName) => {
                const [owner, name] = repoFullName.split('/');
                return (
                  <Link
                    key={repoFullName}
                    href={`/${owner}/${name}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:border-muted-foreground/50 hover:bg-card/80 transition-colors"
                  >
                    <code className="font-mono">{repoFullName}</code>
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* MEMBERS Section */}
      {gripOrg && members && members.length > 0 && (
        <section className="border-b border-border bg-card/30">
          <div className="container py-8">
            <h2 className="mb-4 text-sm font-medium text-muted-foreground">MEMBERS</h2>
            <MemberAvatarGrid members={members} />
          </div>
        </section>
      )}
    </div>
  );
}
