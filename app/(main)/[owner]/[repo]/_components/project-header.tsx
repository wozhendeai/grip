import { TokenAmount } from '@/components/tempo/token-amount';
import { Button } from '@/components/ui/button';
import type { GitHubRepo } from '@/lib/github';
import type { BountyProject } from '@/lib/types';
import {
  CheckCircle,
  Clock,
  Code,
  Coins,
  ExternalLink,
  GitFork,
  Github,
  Plus,
  Star,
} from 'lucide-react';
import Link from 'next/link';
import { EntityHeader } from '@/app/(main)/[owner]/_components/entity-header';

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
 * Uses unified EntityHeader component with repo-specific layout
 * Shows repo name, description, GitHub stats, and BountyLane stats grid
 */
export function ProjectHeader({
  project,
  github,
  isClaimed,
  openBounties = 0,
  completedBounties = 0,
  totalFunded = '0',
  isLoggedIn = false,
}: ProjectHeaderProps) {
  return (
    <EntityHeader
      type="repo"
      name={github.full_name}
      handle={github.name}
      url={github.html_url}
      avatar={github.owner.avatar_url}
      description={github.description}
      isLinked={isClaimed}
      metadata={{
        primary: (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
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
                <Code className="h-3.5 w-3.5" />
                {github.language}
              </span>
            )}
          </div>
        ),
      }}
      action={
        isLoggedIn ? (
          <Button size="sm">
            <Link href={`/${github.owner.login}/${github.name}/bounties/new`}>
              <Plus className="h-4 w-4 mr-2" />
              Create Bounty
            </Link>
          </Button>
        ) : undefined
      }
    >
      {/* Bounty Stats */}
      <div className="mt-6 flex items-center gap-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Coins className="h-3.5 w-3.5" />
          <div className="flex items-baseline gap-1.5">
            <TokenAmount amount={totalFunded} symbol="USDC" className="text-foreground" />
            <span>funded</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          <div className="flex items-baseline gap-1.5">
            <span className="font-medium text-foreground">{openBounties}</span>
            <span>open</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <CheckCircle className="h-3.5 w-3.5" />
          <div className="flex items-baseline gap-1.5">
            <span className="font-medium text-foreground">{completedBounties}</span>
            <span>completed</span>
          </div>
        </div>
      </div>
    </EntityHeader>
  );
}
