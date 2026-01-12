'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupButton } from '@/components/ui/input-group';
import { cn } from '@/lib/utils';
import { Search, ChevronDown } from 'lucide-react';

export type ProfileTab = 'activity' | 'bounties' | 'repositories';

interface ProfileToolbarProps {
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

const FILTER_OPTIONS: Record<ProfileTab, { label: string; value: string }[]> = {
  activity: [
    { label: 'All Activity', value: 'all' },
    { label: 'Completions', value: 'completed' },
    { label: 'Funding', value: 'funded' },
    { label: 'In Progress', value: 'in_progress' },
  ],
  bounties: [
    { label: 'All Bounties', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Completed', value: 'completed' },
  ],
  repositories: [
    { label: 'All Repos', value: 'all' },
    { label: 'With Bounties', value: 'with_bounties' },
  ],
};

const TABS: { key: ProfileTab; label: string }[] = [
  { key: 'activity', label: 'Activity' },
  { key: 'bounties', label: 'Bounties' },
  { key: 'repositories', label: 'Repositories' },
];

export function ProfileToolbar({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  activeFilter,
  onFilterChange,
}: ProfileToolbarProps) {
  const options = FILTER_OPTIONS[activeTab];
  const activeLabel = options.find((o) => o.value === activeFilter)?.label || 'All';

  return (
    <div className="flex flex-col justify-between gap-4 border-b pb-1 md:flex-row md:items-center">
      {/* Navigation Tabs */}
      <div className="-mb-[5px] flex items-center gap-1">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              className={cn(
                'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-muted-foreground/20 hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Filter & Actions */}
      <div className="flex items-center gap-2 pb-2 md:pb-0">
        <InputGroup className="rounded-md">
          <InputGroupAddon align="inline-start">
            <InputGroupButton variant="ghost" size="icon-xs">
              <Search className="size-4" />
            </InputGroupButton>
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Find activity..."
            className="h-8 w-full md:w-64"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </InputGroup>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" className="h-8 gap-2 rounded-md">
                Type: {activeLabel}
                <ChevronDown className="size-3" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            {options.map((option) => (
              <DropdownMenuItem key={option.value} onClick={() => onFilterChange(option.value)}>
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
