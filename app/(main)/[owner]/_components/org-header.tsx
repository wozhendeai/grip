'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatUnits } from 'viem';
import { Github, Info, Settings } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { organization } from '@/db/schema/auth';
import type { GitHubOrganizationMinimal } from '@/lib/github';

interface OrgHeaderProps {
  org: typeof organization.$inferSelect;
  github: GitHubOrganizationMinimal;
  stats: {
    totalFunded: bigint;
    openBounties: number;
    completedBounties: number;
  };
  memberCount: number;
  members: Array<{
    id: string;
    role: string;
    user: {
      id: string;
      name: string;
      image: string | null;
    } | null;
  }> | null;
  isAdmin: boolean;
  isLoggedIn: boolean;
  className?: string;
}

export function OrgHeader({
  org,
  github,
  stats,
  memberCount,
  members,
  isAdmin,
  isLoggedIn,
  className,
}: OrgHeaderProps) {
  const fundedVal = Number(formatUnits(stats.totalFunded, 6)).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });

  return (
    <div className={cn('py-8', className)}>
      <div className="flex flex-col sm:flex-row gap-6 items-start">
        <Avatar className="h-16 w-16 sm:h-20 sm:w-20 border border-border shrink-0">
          <AvatarImage src={org.logo || github.avatar_url} alt={org.name} />
          <AvatarFallback>{org.name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="text-2xl font-bold leading-tight truncate">{org.name}</h1>
            <span className="text-muted-foreground text-lg font-normal">@{github.login}</span>

            <HoverCard>
              <HoverCardTrigger
                render={
                  <Badge
                    variant="secondary"
                    className="gap-1 font-normal text-xs px-2 h-6 hover:bg-secondary/80 cursor-pointer ml-1"
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
                            <AvatarFallback>{member.user?.name?.[0]?.toUpperCase()}</AvatarFallback>
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

            <Popover>
              <PopoverTrigger className="inline-flex items-center justify-center h-6 w-6 rounded-full hover:bg-muted text-muted-foreground transition-colors ml-1">
                <Info className="h-4 w-4" />
              </PopoverTrigger>
              <PopoverContent className="w-80" align="start">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-border">
                      <AvatarImage src={org.logo || github.avatar_url} />
                      <AvatarFallback>{org.name.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-sm">{org.name}</p>
                      <p className="text-xs text-muted-foreground">@{github.login}</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <a
                      href={github.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <Github className="h-4 w-4" />
                      <span>github.com/{github.login}</span>
                    </a>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {isAdmin && (
              <Link
                href={`/${org.slug}/settings`}
                className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'h-6 w-6 ml-1')}
              >
                <Settings className="h-4 w-4" />
              </Link>
            )}
          </div>

          {github.description && (
            <p className="text-sm text-foreground/80 max-w-2xl line-clamp-2 leading-relaxed">
              {github.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground pt-1">
            <span className="flex items-center gap-1.5 text-foreground font-medium">
              <span className="text-success">${fundedVal}</span> funded
            </span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span className="flex items-center gap-1.5 text-foreground font-medium">
              <span>{stats.openBounties}</span> open
            </span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span className="flex items-center gap-1.5 text-foreground font-medium">
              <span>{stats.completedBounties}</span> completed
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
