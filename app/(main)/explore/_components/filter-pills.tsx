'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface FilterPillsProps {
  selectedLanguage: string;
  onLanguageChange: (lang: string) => void;
  minAmount: number;
  onMinAmountChange: (amount: number) => void;
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  availableLanguages: string[];
}

const amountOptions = [
  { label: 'All amounts', value: 0 },
  { label: '$50+', value: 50 },
  { label: '$100+', value: 100 },
  { label: '$250+', value: 250 },
  { label: '$500+', value: 500 },
  { label: '$1000+', value: 1000 },
];

export function FilterPills({
  selectedLanguage,
  onLanguageChange,
  minAmount,
  onMinAmountChange,
  selectedTags,
  onTagsChange,
  availableLanguages,
}: FilterPillsProps) {
  const selectedAmountLabel =
    amountOptions.find((opt) => opt.value === minAmount)?.label || 'All amounts';

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Language filters */}
      {availableLanguages.map((lang) => (
        <button
          key={lang}
          onClick={() => onLanguageChange(lang)}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            selectedLanguage === lang
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
          type="button"
        >
          {lang === 'all' ? 'All' : lang}
        </button>
      ))}

      {/* Divider */}
      {availableLanguages.length > 0 && (
        <div className="mx-2 h-6 w-px bg-slate-200" aria-hidden="true" />
      )}

      {/* Amount filter dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            minAmount > 0
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          {selectedAmountLabel}
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {amountOptions.map((option) => (
            <DropdownMenuItem key={option.value} onClick={() => onMinAmountChange(option.value)}>
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Tag filter: Good first issue */}
      <button
        onClick={() => toggleTag('good first issue')}
        className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
          selectedTags.includes('good first issue')
            ? 'bg-slate-900 text-white'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
        }`}
        type="button"
      >
        Good first issue
      </button>
    </div>
  );
}
