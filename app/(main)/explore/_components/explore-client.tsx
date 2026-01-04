'use client';

import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import type { Bounty, GithubLabel } from '@/lib/types';
import { useMemo, useState } from 'react';
import { formatUnits } from 'viem';
import { BountyFeedItem } from './bounty-feed-item';
import { FilterPills } from './filter-pills';
import type { TopRepo } from './top-repos';
import { TopRepos } from './top-repos';

interface ExploreClientProps {
  bounties: Bounty[];
  topRepos: TopRepo[];
  stats: {
    totalValue: number;
    openCount: number;
  };
}

const languageKeywords = [
  'TypeScript',
  'JavaScript',
  'Rust',
  'Python',
  'Go',
  'C++',
  'Java',
  'Ruby',
  'Swift',
  'Kotlin',
];

function extractLanguageFromLabels(labels: GithubLabel[] | null): string | null {
  if (!labels) return null;

  for (const label of labels) {
    if (!label?.name) continue;

    for (const lang of languageKeywords) {
      if (label.name.toLowerCase().includes(lang.toLowerCase())) {
        return lang;
      }
    }
  }

  return null;
}

export function ExploreClient({ bounties, topRepos, stats }: ExploreClientProps) {
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [minAmount, setMinAmount] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const availableLanguages = useMemo(() => {
    const languages = new Set<string>();
    for (const bounty of bounties) {
      const langFromLabels = extractLanguageFromLabels(bounty.labels);
      if (langFromLabels) languages.add(langFromLabels);
    }
    return ['all', ...Array.from(languages).slice(0, 5)];
  }, [bounties]);

  const filteredBounties = useMemo(() => {
    let filtered = bounties;

    if (selectedLanguage !== 'all') {
      filtered = filtered.filter((b) => extractLanguageFromLabels(b.labels) === selectedLanguage);
    }

    if (minAmount > 0) {
      filtered = filtered.filter(
        (b) => b.totalFunded && Number(formatUnits(BigInt(b.totalFunded), 6)) >= minAmount
      );
    }

    if (selectedTags.length > 0) {
      filtered = filtered.filter((b) =>
        selectedTags.every((tag) =>
          b.labels?.some((l) => l?.name?.toLowerCase() === tag.toLowerCase())
        )
      );
    }

    return filtered;
  }, [bounties, selectedLanguage, minAmount, selectedTags]);

  return (
    <div className="min-h-screen">
      {/* Header Section */}
      <section className="border-b border-border">
        <div className="container py-12">
          <h1 className="mb-2 text-3xl font-bold md:text-4xl">Explore Bounties</h1>
          <p className="max-w-lg text-muted-foreground">
            Find work that matches your skills. Get paid when your PR merges.
          </p>

          {/* Stats Row */}
          <div className="mt-6 flex flex-wrap gap-8">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{stats.openCount}</span>
              <span className="text-sm text-muted-foreground">open bounties</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">${stats.totalValue.toLocaleString()}</span>
              <span className="text-sm text-muted-foreground">available</span>
            </div>
          </div>
        </div>
      </section>

      {/* Top Repos Section */}
      <section className="py-8">
        <TopRepos repos={topRepos} />
      </section>

      {/* Filter Pills Section */}
      <section className="border-b border-border pb-8">
        <div className="container">
          <FilterPills
            selectedLanguage={selectedLanguage}
            onLanguageChange={setSelectedLanguage}
            minAmount={minAmount}
            onMinAmountChange={setMinAmount}
            selectedTags={selectedTags}
            onTagsChange={setSelectedTags}
            availableLanguages={availableLanguages}
          />
        </div>
      </section>

      {/* Bounty Feed Section */}
      <section className="py-8">
        <div className="container">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold">
              {filteredBounties.length} {filteredBounties.length === 1 ? 'Bounty' : 'Bounties'}
            </h2>
          </div>

          {filteredBounties.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No bounties found</EmptyTitle>
                <EmptyDescription>
                  Try adjusting your filters to see more bounties.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="space-y-4">
              {filteredBounties.map((bounty, index) => (
                <BountyFeedItem key={bounty.id} bounty={bounty} index={index} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
