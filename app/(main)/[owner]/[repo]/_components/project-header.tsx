import { TokenAmount } from '@/components/tempo/token-amount';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { GitHubRepo } from '@/lib/github/repo';
import type { BountyProject } from '@/lib/types';
import { GitFork, Github, Plus, Star } from 'lucide-react';
import Link from 'next/link';

interface ProjectHeaderProps {
  project: BountyProject;
  github: GitHubRepo;
  isClaimed: boolean;
  openBounties?: number;
  completedBounties?: number;
  totalFunded?: string; // BigInt serialized as string
  isLoggedIn?: boolean;
}

/**
 * Project header with stats
 *
 * Shows:
 * - Repo name + description (from GitHub)
 * - GitHub stats: Stars, forks, language
 * - Claimed badge (if repo is claimed)
 * - BountyLane stats: Open bounties, Completed, Total paid
 * - Settings link (if user has permission)
 */
export function ProjectHeader({
  project,
  github,
  isClaimed,
  openBounties = 0,
  completedBounties = 0,
  totalFunded = '0', // Default to '0' string for BigInt
  isLoggedIn = false,
}: ProjectHeaderProps) {
  return (
    <div className="space-y-6">
      {/* Title + Description + Actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">
              {github.owner.login}/{github.name}
            </h1>
            <a
              href={github.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              <Github className="h-5 w-5" />
            </a>
            {isClaimed && <Badge variant="secondary">Claimed</Badge>}
          </div>
          {github.description && <p className="mt-2 text-muted-foreground">{github.description}</p>}

          {/* GitHub Stats */}
          <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4" />
              <span>{github.stargazers_count.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <GitFork className="h-4 w-4" />
              <span>{github.forks_count.toLocaleString()}</span>
            </div>
            {github.language && <span>• {github.language}</span>}
          </div>
        </div>

        {/* Actions */}
        {isLoggedIn && (
          <Button
            render={
              <Link href={`/${github.owner.login}/${github.name}/bounties/new`}>
                <Plus className="h-4 w-4 mr-2" />
                Create Bounty
              </Link>
            }
            size="sm"
          />
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Funded</p>
            <TokenAmount amount={totalFunded} symbol="USDC" className="text-xl font-bold" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Open Bounties</p>
            <p className="text-xl font-bold">{openBounties}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Completed</p>
            <p className="text-xl font-bold">{completedBounties}</p>
          </CardContent>
        </Card>
      </div>

      {/* Badges */}
      <div className="flex gap-2">
        {isClaimed && <Badge variant="secondary">Claimed</Badge>}
        {openBounties > 0 && <Badge variant="default">{openBounties} Open</Badge>}
      </div>
    </div>
  );
}
