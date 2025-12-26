import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ExternalLink } from 'lucide-react';

interface EntityHeaderProps {
  type: 'user' | 'org' | 'repo';
  avatar: string;
  name: string;
  handle: string;
  url?: string;
  description?: string | null;
  isLinked?: boolean;
  metadata: {
    primary?: React.ReactNode;
    secondary?: React.ReactNode;
  };
  stats?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * Unified header component for user/org profiles
 *
 * Displays entity avatar, name, handle, description, and metadata.
 * Shows "Not on BountyLane" badge for GitHub-only entities.
 *
 * Design:
 * - Avatar: rounded-full for users, rounded-lg for orgs
 * - Metadata: Two-line structure (primary, then secondary)
 * - Optional stats row for BountyLane entities
 * - Optional action button (e.g., Send Payment)
 */
export function EntityHeader({
  type,
  avatar,
  name,
  handle,
  url,
  description,
  isLinked = true,
  metadata,
  stats,
  action,
  children,
}: EntityHeaderProps) {
  return (
    <section className="border-b border-border bg-card/30">
      <div className="container py-12">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <Avatar className={cn('h-16 w-16', type !== 'user' && 'rounded-lg')}>
              <AvatarImage src={avatar} alt={handle} />
              <AvatarFallback className={cn(type !== 'user' && 'rounded-lg')}>
                {handle[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>

            {/* Content Column */}
            <div className="flex-1">
              {/* Name + Link Icon + Badge (for repos) */}
              <div className="flex items-center gap-2">
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 hover:text-muted-foreground transition-colors"
                  >
                    <h1 className="text-2xl font-semibold">{name}</h1>
                    <ExternalLink className="h-5 w-5" />
                  </a>
                ) : (
                  <h1 className="text-2xl font-semibold">{name}</h1>
                )}

                {/* Badge inline with name for repos */}
                {isLinked && type === 'repo' && (
                  <Badge variant="secondary" className="text-xs">
                    Claimed
                  </Badge>
                )}
              </div>

              {/* Handle + Badge (for users/orgs only) */}
              {type !== 'repo' && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">@{handle}</span>
                  {!isLinked && (
                    <Badge variant="secondary" className="text-xs">
                      Not on BountyLane
                    </Badge>
                  )}
                </div>
              )}

              {/* Description */}
              {description && (
                <p className="mt-2 text-sm text-muted-foreground max-w-2xl line-clamp-3">
                  {description}
                </p>
              )}

              {/* Primary Metadata */}
              {metadata.primary && (
                <div className="mt-3 text-sm text-muted-foreground">{metadata.primary}</div>
              )}

              {/* Secondary Metadata */}
              {metadata.secondary && (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {metadata.secondary}
                </div>
              )}

              {/* Children slot */}
              {children}
            </div>
          </div>

          {/* Action Button */}
          {action && <div className="shrink-0">{action}</div>}
        </div>

        {/* Stats Row */}
        {stats && <div className="mt-6">{stats}</div>}
      </div>
    </section>
  );
}
