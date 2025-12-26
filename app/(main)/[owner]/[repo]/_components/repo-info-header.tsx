import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { GitHubRepo } from '@/lib/github';
import { Code, ExternalLink, GitFork, Star } from 'lucide-react';
import Link from 'next/link';

interface RepoInfoHeaderProps {
  github: GitHubRepo;
  isClaimed: boolean;
}

export function RepoInfoHeader({ github, isClaimed }: RepoInfoHeaderProps) {
  return (
    <div className="flex gap-4">
      <Avatar className="h-14 w-14 rounded-lg flex-shrink-0">
        <AvatarImage src={github.owner.avatar_url} alt={github.owner.login} />
        <AvatarFallback className="rounded-lg bg-blue-500 text-white">
          {github.owner.login.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Link
            href={github.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xl font-semibold hover:underline inline-flex items-center gap-1.5"
          >
            {github.full_name}
            <ExternalLink className="h-4 w-4" />
          </Link>
          {isClaimed && (
            <Badge variant="secondary" className="text-xs">
              Claimed
            </Badge>
          )}
        </div>

        {github.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{github.description}</p>
        )}

        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5" />
            {github.stargazers_count.toLocaleString()}
          </span>
          <span className="flex items-center gap-1.5">
            <GitFork className="h-3.5 w-3.5" />
            {github.forks_count.toLocaleString()}
          </span>
          {github.language && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-400" />
              {github.language}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
