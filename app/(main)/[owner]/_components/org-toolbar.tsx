'use client';

import { cn } from '@/lib/utils';

export type OrgTab = 'bounties' | 'repositories' | 'activity';

interface OrgToolbarProps {
  activeTab: OrgTab;
  onTabChange: (tab: OrgTab) => void;
  counts?: {
    bounties?: number;
    repositories?: number;
    activity?: number;
  };
}

const TABS: { key: OrgTab; label: string }[] = [
  { key: 'bounties', label: 'Bounties' },
  { key: 'repositories', label: 'Repositories' },
  { key: 'activity', label: 'Activity' },
];

export function OrgToolbar({ activeTab, onTabChange, counts }: OrgToolbarProps) {
  return (
    <div className="flex items-center gap-1 border-b pb-1 -mb-[1px]">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        const count = counts?.[tab.key];
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              isActive
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/20'
            )}
          >
            {tab.label}
            {count !== undefined && (
              <span className="ml-1.5 text-muted-foreground">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
