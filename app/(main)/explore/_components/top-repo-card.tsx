import type { TopRepo } from './top-repos';
import Link from 'next/link';

interface TopRepoCardProps {
  repo: TopRepo;
  href: string;
}

export function TopRepoCard({ repo, href }: TopRepoCardProps) {
  return (
    <Link href={href} className="group block">
      <div className="flex items-start justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-slate-300">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold uppercase text-slate-700">
            {repo.githubOwner.slice(0, 2)}
          </div>
          <div className="flex flex-col">
            <span className="font-medium text-slate-900">{repo.githubFullName}</span>
            <span className="text-sm text-slate-500">
              {repo.openBountyCount} open {repo.openBountyCount === 1 ? 'bounty' : 'bounties'}
            </span>
          </div>
        </div>
        <div className="text-lg font-semibold text-slate-900">
          $
          {repo.totalBountyValue.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
      </div>
    </Link>
  );
}
