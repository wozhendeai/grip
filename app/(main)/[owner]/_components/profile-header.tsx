'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MapPin, Link as LinkIcon, Calendar, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { ProfileStats } from './profile-stats';
import { AboutDialog } from './about-dialog';
import { TipDialog } from './tip-dialog';
import { Skeleton } from '@/components/ui/skeleton';

interface ProfileHeaderProps {
  user: {
    avatarUrl: string | null;
    name: string | null;
    username: string;
    bio?: string | null;
    location?: string | null;
    website?: string | null;
    joinedAt?: string | Date | null;
    htmlUrl: string;
  };
  stats?: {
    totalEarned: bigint;
    bountiesCompleted: number;
    activeClaims: number;
  };
  organizations?: {
    organization: {
      id: string | number;
      slug: string;
      logo: string | null;
      name: string;
    };
  }[];
  isLoading?: boolean;
  className?: string;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(date);
}

export function ProfileHeader({
  user,
  stats,
  organizations = [],
  isLoading,
  className,
}: ProfileHeaderProps) {
  if (isLoading) {
    return (
      <div className={cn('flex flex-col gap-6 py-8', className)}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-6">
            <Skeleton className="size-24 rounded-full md:size-32" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-5 w-32" />
            </div>
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full max-w-2xl" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="flex gap-6">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
    );
  }

  const initials = user.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : user.username.slice(0, 2).toUpperCase();

  const joinedDate = user.joinedAt ? formatDate(new Date(user.joinedAt)) : null;

  return (
    <div className={cn('flex flex-row gap-6 py-8 md:gap-8', className)}>
      {/* Avatar Column */}
      <div className="shrink-0">
        <Avatar className="size-24 border-4 border-background shadow-lg md:size-32">
          <AvatarImage src={user.avatarUrl || undefined} alt={user.name || user.username} />
          <AvatarFallback className="text-2xl md:text-3xl">{initials}</AvatarFallback>
        </Avatar>
      </div>

      {/* Content Column */}
      <div className="flex-1 space-y-4">
        {/* Name Row with Actions */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{user.name || user.username}</h1>
              <AboutDialog
                username={user.username}
                name={user.name}
                avatarUrl={user.avatarUrl}
                memberSince={user.joinedAt || null}
                htmlUrl={user.htmlUrl}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-lg text-muted-foreground">@{user.username}</span>
              {organizations.length > 0 && (
                <div className="flex items-center gap-2">
                  {organizations.slice(0, 3).map((org) => (
                    <Link key={org.organization.id} href={`/${org.organization.slug}`}>
                      <Badge
                        variant="secondary"
                        className="h-6 gap-1 px-2 text-xs font-normal hover:bg-secondary/80"
                      >
                        {org.organization.name}
                      </Badge>
                    </Link>
                  ))}
                  {organizations.length > 3 && (
                    <Badge variant="outline" className="h-6 px-2 text-xs">
                      +{organizations.length - 3}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tip Button - Desktop only */}
          <div className="hidden items-center gap-2 md:flex">
            <TipDialog
              username={user.username}
              name={user.name}
              avatarUrl={user.avatarUrl}
            />
          </div>
        </div>

        {/* Bio */}
        {user.bio && (
          <p className="text-base leading-relaxed text-muted-foreground">{user.bio}</p>
        )}

        {/* Metadata */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {user.location && (
            <span className="flex items-center gap-2">
              <MapPin className="size-4 text-foreground/70" />
              {user.location}
            </span>
          )}
          {user.website && (
            <span className="flex items-center gap-2">
              <LinkIcon className="size-4 text-foreground/70" />
              <a
                href={user.website.startsWith('http') ? user.website : `https://${user.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-foreground hover:underline"
              >
                {user.website.replace(/^https?:\/\//, '')}
              </a>
            </span>
          )}
          {joinedDate && (
            <span className="flex items-center gap-2">
              <Calendar className="size-4 text-foreground/70" />
              Joined {joinedDate}
            </span>
          )}
        </div>

        {/* Stats */}
        {stats && (
          <ProfileStats
            bountiesCompleted={stats.bountiesCompleted}
            totalEarned={stats.totalEarned}
            activeClaims={stats.activeClaims}
          />
        )}

        {/* Tip Button - Mobile only */}
        <div className="md:hidden">
          <TipDialog
            username={user.username}
            name={user.name}
            avatarUrl={user.avatarUrl}
          >
            <Button variant="outline" className="w-full gap-2">
              <DollarSign className="size-4" />
              Tip @{user.username}
            </Button>
          </TipDialog>
        </div>
      </div>
    </div>
  );
}
