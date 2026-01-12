'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Github, Settings, LinkIcon, Calendar } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { organization } from '@/db/schema/auth';
import type { GitHubOrganizationMinimal } from '@/lib/github';
import { OrgStats } from './org-stats';

interface OrgHeaderProps {
  org: typeof organization.$inferSelect;
  github: GitHubOrganizationMinimal;
  stats: {
    totalFunded: bigint;
    openBounties: number;
    completedBounties: number;
  };
  memberCount: number;
  repoCount: number;
  members: Array<{
    id: string;
    role: string;
    user: {
      id: string;
      name: string;
      image: string | null;
    } | null;
  }> | null;
  isMember: boolean;
  isLoggedIn: boolean;
  className?: string;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(date);
}

export function OrgHeader({
  org,
  github,
  stats,
  memberCount,
  repoCount,
  members,
  isMember,
  className,
}: OrgHeaderProps) {
  const website = github.blog || null;

  return (
    <div className={cn('py-8', className)}>
      <div className="flex flex-col md:flex-row gap-6 md:gap-8">
        {/* Avatar */}
        <div className="shrink-0">
          <Avatar className="size-24 md:size-32 border-4 border-background shadow-lg">
            <AvatarImage src={org.logo || github.avatar_url} alt={org.name} />
            <AvatarFallback className="text-2xl md:text-3xl">
              {org.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-4">
          {/* Name Row */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-bold tracking-tight">{org.name}</h1>
                <HoverCard>
                  <HoverCardTrigger
                    render={
                      <Badge
                        variant="secondary"
                        className="gap-1 font-normal text-xs px-2 h-6 hover:bg-secondary/80 cursor-pointer"
                      >
                        {memberCount} {memberCount === 1 ? 'member' : 'members'}
                      </Badge>
                    }
                  />
                  <HoverCardContent className="w-80" align="start">
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        People with access to this organization.
                      </p>
                      {members && members.length > 0 ? (
                        <div className="grid grid-cols-5 gap-2">
                          {members.slice(0, 10).map((member) => (
                            <Link
                              key={member.id}
                              href={`/${member.user?.name}`}
                              title={member.user?.name}
                              className="relative"
                            >
                              <Avatar className="h-9 w-9 border border-border">
                                <AvatarImage src={member.user?.image || ''} />
                                <AvatarFallback>
                                  {member.user?.name?.[0]?.toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            </Link>
                          ))}
                          {members.length > 10 && (
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                              +{members.length - 10}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No members yet.</p>
                      )}
                    </div>
                  </HoverCardContent>
                </HoverCard>
              </div>
              <div className="text-lg text-muted-foreground">@{github.login}</div>
            </div>

            {/* Actions */}
            <div className="hidden md:flex items-center gap-2">
              {isMember ? (
                <Link
                  href={`/${org.slug}/settings`}
                  className={cn(buttonVariants({ size: 'sm' }), 'gap-2')}
                >
                  <Settings className="size-4" strokeWidth={2} />
                  Go to Dashboard
                </Link>
              ) : (
                <a
                  href={github.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-2')}
                >
                  <Github className="size-4" strokeWidth={2} />
                  View on GitHub
                </a>
              )}
            </div>
          </div>

          {/* Description */}
          {github.description && (
            <p className="text-base text-muted-foreground leading-relaxed">{github.description}</p>
          )}

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {website && (
              <span className="flex items-center gap-2">
                <LinkIcon className="size-4 text-foreground/70" strokeWidth={2} />
                <a
                  href={website.startsWith('http') ? website : `https://${website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground hover:underline transition-colors"
                >
                  {website}
                </a>
              </span>
            )}
            <span className="flex items-center gap-2">
              <Calendar className="size-4 text-foreground/70" strokeWidth={2} />
              Since {formatDate(org.createdAt)}
            </span>
          </div>

          {/* Stats */}
          <OrgStats
            totalFunded={stats.totalFunded}
            memberCount={memberCount}
            repoCount={repoCount}
          />

          {/* Mobile Action */}
          <div className="md:hidden">
            {isMember ? (
              <Link
                href={`/${org.slug}/settings`}
                className={cn(buttonVariants(), 'w-full gap-2')}
              >
                <Settings className="size-4" strokeWidth={2} />
                Go to Dashboard
              </Link>
            ) : (
              <a
                href={github.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: 'outline' }), 'w-full gap-2')}
              >
                <Github className="size-4" strokeWidth={2} />
                View on GitHub
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
