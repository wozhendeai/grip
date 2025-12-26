'use client';

import type { TabType } from './dashboard-client';

interface DashboardTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  counts: {
    created: number;
    claimed: number;
    watching: number;
    completed: number;
  };
}

const TABS: { id: TabType; label: string }[] = [
  { id: 'created', label: 'Created' },
  { id: 'claimed', label: 'Claimed' },
  { id: 'watching', label: 'Watching' },
  { id: 'completed', label: 'Completed' },
];

/**
 * Tab navigation for dashboard
 * Uses pill-style buttons matching Explore page filter pills
 */
export function DashboardTabs({ activeTab, onTabChange, counts }: DashboardTabsProps) {
  return (
    <div
      className="flex items-center gap-3 overflow-x-auto pb-2"
      role="tablist"
      aria-label="Dashboard tabs"
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const count = counts[tab.id];

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`${tab.id}-panel`}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {tab.label}
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                isActive
                  ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                  : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
