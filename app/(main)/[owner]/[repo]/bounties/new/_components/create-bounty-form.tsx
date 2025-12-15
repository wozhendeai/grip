'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ButtonGroup, ButtonGroupSeparator } from '@/components/ui/button-group';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import type { GitHubRepo } from '@/lib/github/repo';
import { cn } from '@/lib/utils';
import { ExternalLink, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  htmlUrl: string;
  labels: Array<{ name: string; color: string }>;
  user: {
    login: string;
    avatarUrl: string;
  };
  createdAt: string;
  hasBounty: boolean;
}

interface CreateBountyFormProps {
  githubRepo: GitHubRepo;
  projectId: string | null; // BigInt serialized as string
  owner: string;
  repo: string;
}

/**
 * Create Bounty Form - PERMISSIONLESS
 *
 * Multi-step form for creating a bounty:
 * 1. Select an issue from the list
 * 2. Set the bounty amount
 * 3. Configure claim deadline
 * 4. Create as draft or publish immediately
 *
 * Works for both claimed and unclaimed repos.
 */
export function CreateBountyForm({ githubRepo, projectId, owner, repo }: CreateBountyFormProps) {
  const router = useRouter();
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [isLoadingIssues, setIsLoadingIssues] = useState(true);
  const [issuesError, setIssuesError] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [hasMoreIssues, setHasMoreIssues] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [selectedIssue, setSelectedIssue] = useState<GitHubIssue | null>(null);
  const [searchInput, setSearchInput] = useState(''); // User types here
  const [debouncedSearch, setDebouncedSearch] = useState(''); // API searches this
  const [amount, setAmount] = useState('');
  const [claimDeadlineDays, setClaimDeadlineDays] = useState('14');
  const [payoutMode, setPayoutMode] = useState<'manual' | 'auto'>('manual');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Ref for infinite scroll sentinel element
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Debounce search input to avoid hitting GitHub rate limits:
  // - 300ms delay balances responsiveness vs API rate limits
  // - Separate states: searchInput (instant) vs debouncedSearch (delayed)
  // - Cancels previous timer on each keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);
  useEffect(() => {
    async function fetchIssues() {
      setIsLoadingIssues(true);
      setIssuesError(null);

      try {
        const searchParam = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : '';
        const res = await fetch(`/api/github/repos/${owner}/${repo}/issues?page=1${searchParam}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch issues');
        }

        setIssues(data.issues ?? []);
        setPage(1);
        setHasMoreIssues(data.hasNextPage ?? false);
      } catch (err) {
        setIssuesError(err instanceof Error ? err.message : 'Failed to fetch issues');
      } finally {
        setIsLoadingIssues(false);
      }
    }

    fetchIssues();
  }, [owner, repo, debouncedSearch]);
  useEffect(() => {
    if (issues.length > 0 && !selectedIssue) {
      setSelectedIssue(issues[0]);
    }
  }, [issues, selectedIssue]);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMoreIssues || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreIssues();
        }
      },
      {
        root: null, // viewport
        rootMargin: '100px', // Trigger 100px before reaching bottom
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMoreIssues, isLoadingMore]);

  async function refetchIssues() {
    setIsLoadingIssues(true);
    setIssuesError(null);

    try {
      const res = await fetch(`/api/github/repos/${owner}/${repo}/issues?page=1`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch issues');
      }

      setIssues(data.issues ?? []);
      setPage(1);
      setHasMoreIssues(data.hasNextPage ?? false);
    } catch (err) {
      setIssuesError(err instanceof Error ? err.message : 'Failed to fetch issues');
    } finally {
      setIsLoadingIssues(false);
    }
  }

  async function loadMoreIssues() {
    if (!hasMoreIssues || isLoadingMore) return;

    setIsLoadingMore(true);

    try {
      const nextPage = page + 1;
      const searchParam = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : '';
      const res = await fetch(
        `/api/github/repos/${owner}/${repo}/issues?page=${nextPage}${searchParam}`
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch more issues');
      }

      // Append new issues to existing list
      setIssues((prev) => [...prev, ...(data.issues ?? [])]);
      setPage(nextPage);
      setHasMoreIssues(data.hasNextPage ?? false);
    } catch (err) {
      console.error('Failed to load more issues:', err);
      // Error is logged but doesn't break existing issues
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function handleSubmit(publish: boolean) {
    if (!selectedIssue) {
      setSubmitError('Please select an issue');
      return;
    }

    const amountNum = Number.parseFloat(amount);
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      setSubmitError('Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Use new permissionless /api/bounties endpoint
      const res = await fetch('/api/bounties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner,
          repo,
          githubIssueNumber: selectedIssue.number,
          amount: amountNum,
          claimDeadlineDays: Number.parseInt(claimDeadlineDays, 10),
          payoutMode,
          publish,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create bounty');
      }

      // Success - redirect to bounty page
      router.push(`/${owner}/${repo}/bounties/${data.bounty.id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create bounty');
      setIsSubmitting(false);
    }
  }

  if (isLoadingIssues) {
    return (
      <div className="max-w-2xl space-y-6">
        <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
        <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
        <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  if (issuesError) {
    return (
      <div className="max-w-2xl rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center">
        <p className="text-destructive">{issuesError}</p>
        <Button onClick={refetchIssues} variant="outline" className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="max-w-2xl rounded-lg border border-border bg-muted/30 p-6 text-center">
        <h3 className="font-medium">No issues available</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          All open issues in this repository already have bounties, or there are no open issues.
        </p>
        <Button
          render={
            <a
              href={`https://github.com/${owner}/${repo}/issues/new`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Create Issue on GitHub
            </a>
          }
          variant="outline"
          className="mt-4"
        />
      </div>
    );
  }
  const IssueListItem = ({ issue }: { issue: GitHubIssue }) => (
    <div className="flex items-start gap-3 w-full">
      <Badge variant="outline" className="shrink-0">
        #{issue.number}
      </Badge>

      <div className="flex-1 min-w-0">
        <p className="body-sm font-medium truncate">{issue.title}</p>

        <div className="flex items-center gap-2 mt-1 caption text-muted-foreground">
          <span>Opened {new Date(issue.createdAt).toLocaleDateString()}</span>
          {issue.labels.length > 0 && (
            <>
              <Separator orientation="vertical" className="h-3" />
              <div className="flex gap-1">
                {issue.labels.slice(0, 2).map((label) => (
                  <Badge key={label.name} variant="secondary" className="text-xs">
                    {label.name}
                  </Badge>
                ))}
                {issue.labels.length > 2 && (
                  <span className="text-xs">+{issue.labels.length - 2}</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
  const IssueDetailsPanel = ({ issue }: { issue: GitHubIssue | null }) => {
    if (!issue) {
      return (
        <div className="h-full flex items-center justify-center p-8">
          <div className="text-center max-w-sm">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Search className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="heading-4 mb-2">No issue selected</h3>
            <p className="body-sm text-muted-foreground">
              Search and select an issue from the list to view details
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline">#{issue.number}</Badge>
                <h3 className="heading-4 truncate">{issue.title}</h3>
              </div>

              <div className="flex items-center gap-2 caption text-muted-foreground">
                <span>Opened by {issue.user.login}</span>
                <Separator orientation="vertical" className="h-3" />
                <span>{new Date(issue.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Labels */}
          {issue.labels.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {issue.labels.map((label) => (
                <Badge
                  key={label.name}
                  variant="secondary"
                  style={{
                    backgroundColor: `#${label.color}20`,
                    color: `#${label.color}`,
                  }}
                >
                  {label.name}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {issue.body ? (
            <p className="body-sm whitespace-pre-wrap">{issue.body}</p>
          ) : (
            <p className="text-muted-foreground italic">No description provided.</p>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border">
          <a
            href={issue.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            View on GitHub
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-12">
      {/* Issue Selection - Command with Two-Panel Layout
          Using Command component for built-in search/keyboard nav,
          but customizing CommandList to display as two-column grid */}
      <Field>
        <FieldLabel>Select Issue</FieldLabel>

        <Command className="rounded-lg border border-border h-[600px] mt-2" shouldFilter={false}>
          <CommandInput
            value={searchInput}
            onValueChange={setSearchInput}
            placeholder="Search issues by number or title..."
          />

          <CommandList className="max-h-none">
            <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6 p-4 h-[calc(600px-60px)]">
              {/* Left Column: Searchable Issue List */}
              <div className="flex flex-col gap-2 min-h-0">
                <CommandEmpty>No issues found matching your search.</CommandEmpty>

                <CommandGroup className="overflow-y-auto space-y-2">
                  {issues.map((issue) => (
                    <CommandItem
                      key={issue.number}
                      value={`#${issue.number} ${issue.title}`}
                      onSelect={() => setSelectedIssue(issue)}
                      className={cn(
                        'cursor-pointer',
                        selectedIssue?.number === issue.number &&
                          'bg-primary/5 border border-primary'
                      )}
                    >
                      <IssueListItem issue={issue} />
                    </CommandItem>
                  ))}
                </CommandGroup>

                {/* Sentinel element for infinite scroll - auto-loads when scrolled into view */}
                {hasMoreIssues && (
                  <div ref={sentinelRef} className="py-4 text-center">
                    {isLoadingMore && (
                      <span className="text-sm text-muted-foreground">Loading more...</span>
                    )}
                  </div>
                )}
              </div>

              {/* Right Column: Details Panel */}
              <div className="border-l border-border pl-6 overflow-y-auto hidden lg:block">
                <IssueDetailsPanel issue={selectedIssue} />
              </div>
            </div>
          </CommandList>
        </Command>
      </Field>

      {/* Amount + Terms Section (grouped for better visual hierarchy) */}
      <div className="space-y-6">
        {/* Amount */}
        <Field>
          <FieldLabel htmlFor="amount">Bounty Amount (USD)</FieldLabel>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              $
            </span>
            <Input
              id="amount"
              type="number"
              min="1"
              step="1"
              placeholder="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pl-8"
            />
          </div>
          <FieldDescription>
            This is the amount in USDC that will be paid to the contributor when their PR is
            approved.
          </FieldDescription>
        </Field>

        {/* Deadline + Payment Approval (side-by-side on larger screens) */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Claim Deadline */}
          <Field>
            <FieldLabel htmlFor="deadline">Claim Deadline</FieldLabel>
            <Select
              value={claimDeadlineDays}
              onValueChange={(value) => setClaimDeadlineDays(value || '7')}
            >
              <SelectTrigger id="deadline">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days after claiming</SelectItem>
                <SelectItem value="14">14 days after claiming</SelectItem>
                <SelectItem value="30">30 days after claiming</SelectItem>
                <SelectItem value="60">60 days after claiming</SelectItem>
              </SelectContent>
            </Select>
            <FieldDescription>
              Contributors must submit a PR within this time after claiming, or the claim expires.
            </FieldDescription>
          </Field>

          {/* Payment Approval */}
          <Field>
            <FieldLabel htmlFor="payoutMode">Payment Approval</FieldLabel>
            <Select
              value={payoutMode}
              onValueChange={(value) => setPayoutMode(value as 'manual' | 'auto')}
            >
              <SelectTrigger id="payoutMode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual Approval (Recommended)</SelectItem>
                <SelectItem value="auto">Auto-Pay on Merge</SelectItem>
              </SelectContent>
            </Select>
            <FieldDescription>
              {payoutMode === 'manual' ? (
                <>
                  You&apos;ll review and approve the payment after the PR is merged. Best for larger
                  bounties or complex work.
                </>
              ) : (
                <>
                  Payment automatically approved when PR merges. You&apos;ll still sign with your
                  passkey. Best for small, straightforward bounties.
                </>
              )}
            </FieldDescription>
          </Field>
        </div>
      </div>

      {/* Error */}
      {submitError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{submitError}</p>
        </div>
      )}

      {/* Actions */}
      <ButtonGroup className="pt-4">
        <Button
          onClick={() => handleSubmit(true)}
          disabled={isSubmitting || !selectedIssue || !amount}
        >
          {isSubmitting ? 'Creating...' : 'Create & Publish'}
        </Button>
        <ButtonGroupSeparator />
        <Button
          onClick={() => handleSubmit(false)}
          disabled={isSubmitting || !selectedIssue || !amount}
          variant="outline"
        >
          Save as Draft
        </Button>
      </ButtonGroup>

      {/* Info */}
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <h4 className="font-medium">What happens when you publish?</h4>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          <li>• A &quot;bounty&quot; label is added to the GitHub issue</li>
          <li>• A comment is posted on the issue with bounty details</li>
          <li>• The bounty becomes visible to contributors on BountyLane</li>
          <li>• Contributors can claim and start working on the issue</li>
        </ul>
      </div>
    </div>
  );
}
