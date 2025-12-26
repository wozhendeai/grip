import type { Bounty } from '@/lib/types';
import { formatTimeAgo } from '@/lib/utils';
import Link from 'next/link';
import { formatUnits } from 'viem';

interface BountyFeedItemProps {
  bounty: Bounty;
  index?: number;
}

const labelColorMap: Record<string, string> = {
  bug: 'bg-red-100 text-red-700',
  enhancement: 'bg-blue-100 text-blue-700',
  'good first issue': 'bg-green-100 text-green-700',
  'good-first-issue': 'bg-green-100 text-green-700',
  documentation: 'bg-purple-100 text-purple-700',
  'help wanted': 'bg-amber-100 text-amber-700',
  question: 'bg-pink-100 text-pink-700',
};

function getLabelColor(labelName: string | undefined): string {
  if (!labelName) return 'bg-slate-100 text-slate-700';
  const normalized = labelName.toLowerCase();
  return labelColorMap[normalized] || 'bg-slate-100 text-slate-700';
}

export function BountyFeedItem({ bounty }: BountyFeedItemProps) {
  const bountyUrl = `/${bounty.project.githubOwner}/${bounty.project.githubRepo}/bounties/${bounty.id}`;
  const labels = (bounty.labels ?? []).filter((label) => label?.name);
  const displayLabels = labels.slice(0, 3);
  const remainingCount = labels.length - 3;

  const amountInUsdc = Number(formatUnits(BigInt(bounty.totalFunded), 6));

  return (
    <Link href={bountyUrl} className="group block">
      <article className="space-y-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-slate-300">
        {/* Header: Icon + Repo + Issue # + Amount */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold uppercase text-slate-700">
              {bounty.githubOwner.slice(0, 2)}
            </div>
            <div className="min-w-0">
              <div className="text-sm text-slate-500">
                {bounty.project.githubFullName} · #{bounty.githubIssueNumber}
              </div>
            </div>
          </div>
          <div className="shrink-0 text-lg font-semibold text-emerald-600">
            $
            {amountInUsdc.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-slate-900">{bounty.title}</h3>

        {/* Description preview */}
        {bounty.body && <p className="line-clamp-2 text-sm text-slate-500">{bounty.body}</p>}

        {/* Footer: Tags + Timestamp */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {displayLabels.map((label, idx) => (
              <span
                key={`${label.name}-${idx}`}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${getLabelColor(label.name)}`}
              >
                {label.name}
              </span>
            ))}
            {remainingCount > 0 && (
              <span className="text-xs text-slate-400">+{remainingCount} more</span>
            )}
          </div>
          {bounty.createdAt && (
            <span className="ml-auto shrink-0 text-xs text-slate-400">
              Posted {formatTimeAgo(bounty.createdAt)}
            </span>
          )}
        </div>
      </article>
    </Link>
  );
}
