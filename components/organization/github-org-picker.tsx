'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Loader2, Search } from 'lucide-react';
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
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function fetchOrgs() {
      try {
        const res = await fetch('/api/github/organizations');
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to fetch organizations');
        }
        const { organizations } = await res.json();
        setOrgs(organizations);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load organizations');
      } finally {
        setLoading(false);
      }
    }

    fetchOrgs();
  }, []);

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

  if (error) {
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
        <div className="py-8 text-center">
          <p className="body-base text-muted-foreground">
            No GitHub organizations found where you're an admin.
          </p>
          <p className="caption text-muted-foreground mt-2">
            Only organization admins can link GitHub orgs to GRIP.
          </p>
        </div>
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
