'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth/auth-client';
import { AlertCircle, Building2, Loader2, Lock, Search } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * GitHubOrgPicker - Step 2a of organization creation (GitHub flow)
 *
 * Features:
 * - Fetches user's GitHub orgs from API (admin-only)
 * - Search filter for large org lists
 * - Loading/error/empty states
 * - Back button to return to type selector
 *
 * Security: API filters to admin-only orgs server-side
 */

type GitHubOrg = {
  id: number;
  login: string;
  avatar_url: string;
  description: string | null;
  name: string | null;
};

type GitHubOrgPickerProps = {
  onSelect: (org: GitHubOrg) => void;
  onBack: () => void;
};

export function GitHubOrgPicker({ onSelect, onBack }: GitHubOrgPickerProps) {
  const [orgs, setOrgs] = useState<GitHubOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'fetch' | 'insufficient_scope' | null>(null);
  const [isReauthorizing, setIsReauthorizing] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function fetchOrgs() {
      try {
        const res = await fetch('/api/github/organizations');
        if (!res.ok) {
          const data = await res.json();

          // Check for insufficient scope error
          if (data.error === 'INSUFFICIENT_SCOPE') {
            setErrorType('insufficient_scope');
            return;
          }

          setErrorType('fetch');
          setError(data.error || 'Failed to fetch organizations');
          return;
        }
        const { organizations } = await res.json();
        setOrgs(organizations);
        setErrorType(null);
      } catch (err) {
        setErrorType('fetch');
        setError(err instanceof Error ? err.message : 'Failed to load organizations');
      } finally {
        setLoading(false);
      }
    }

    fetchOrgs();
  }, []);

  async function handleGrantAccess() {
    setIsReauthorizing(true);
    try {
      await authClient.linkSocial({
        provider: 'github',
        scopes: ['read:org'],
        callbackURL: window.location.pathname,
      });
    } catch (error) {
      console.error('Re-authorization failed:', error);
      setIsReauthorizing(false);
      setErrorType('fetch');
      setError('Failed to grant access. Please try again.');
    }
  }

  function handleCancelReauth() {
    setErrorType('fetch');
    setError('Additional permissions needed. Try again when ready.');
  }

  const filteredOrgs = orgs.filter(
    (org) =>
      org.login.toLowerCase().includes(search.toLowerCase()) ||
      org.name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        <p className="caption text-muted-foreground mt-4">Loading GitHub organizations...</p>
      </div>
    );
  }

  // Insufficient scope state - show re-authorization prompt
  if (errorType === 'insufficient_scope') {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <Lock className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="body-sm font-medium text-primary">Additional Permission Required</p>
            <p className="body-xs text-muted-foreground mt-1">
              GRIP needs permission to access your GitHub organizations. This is needed to verify
              you're an admin and authorize the link.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleGrantAccess} disabled={isReauthorizing} className="flex-1">
            {isReauthorizing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Redirecting...
              </>
            ) : (
              'Grant Access'
            )}
          </Button>
          <Button variant="outline" onClick={handleCancelReauth} disabled={isReauthorizing}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // Generic error state
  if (errorType === 'fetch' || error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="body-sm text-destructive">{error}</p>
        </div>
        <Button variant="outline" onClick={onBack} className="w-full">
          Go Back
        </Button>
      </div>
    );
  }

  if (orgs.length === 0) {
    return (
      <div className="space-y-4">
        <Empty className="py-8">
          <EmptyMedia variant="icon">
            <Building2 />
          </EmptyMedia>
          <EmptyTitle>No GitHub organizations found</EmptyTitle>
          <EmptyDescription>
            No GitHub organizations found where you&apos;re an admin. Only organization admins can
            link GitHub orgs to GRIP.
          </EmptyDescription>
        </Empty>
        <Button variant="outline" onClick={onBack} className="w-full">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search organizations..."
          className="pl-9"
        />
      </div>

      {/* Organization List */}
      <div className="max-h-[300px] overflow-y-auto space-y-2">
        {filteredOrgs.map((org) => (
          <button
            key={org.id}
            onClick={() => onSelect(org)}
            type="button"
            className="w-full flex items-start gap-3 p-3 border rounded-lg hover:border-primary hover:bg-primary/5 transition-all text-left"
          >
            <Avatar className="h-10 w-10">
              <AvatarImage src={org.avatar_url} />
              <AvatarFallback>{org.login.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="body-base font-medium truncate">{org.name || org.login}</p>
              <p className="caption text-muted-foreground">@{org.login}</p>
              {org.description && (
                <p className="caption text-muted-foreground mt-1 line-clamp-2">{org.description}</p>
              )}
            </div>
          </button>
        ))}

        {filteredOrgs.length === 0 && (
          <p className="py-8 text-center caption text-muted-foreground">
            No organizations match "{search}"
          </p>
        )}
      </div>

      <Button variant="outline" onClick={onBack} className="w-full">
        Back
      </Button>
    </div>
  );
}
