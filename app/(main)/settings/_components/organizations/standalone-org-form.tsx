'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * StandaloneOrgForm - Step 2b of organization creation (Standalone flow)
 *
 * Features:
 * - Name input with validation
 * - Auto-slugify from name (lowercase, hyphens)
 * - Manual slug override allowed
 * - Client-side validation
 * - Disabled state during submission
 */

type StandaloneOrgFormProps = {
  onSubmit: (data: { name: string; slug: string }) => Promise<void>;
  onBack: () => void;
};

export function StandaloneOrgForm({ onSubmit, onBack }: StandaloneOrgFormProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate slug from name (unless user manually edited it)
  useEffect(() => {
    if (!slugEdited) {
      const autoSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setSlug(autoSlug);
    }
  }, [name, slugEdited]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim() || !slug.trim()) {
      setError('Name and slug are required');
      return;
    }

    if (!/^[a-z0-9-]+$/.test(slug)) {
      setError('Slug can only contain lowercase letters, numbers, and hyphens');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onSubmit({ name: name.trim(), slug: slug.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name Input */}
      <div className="space-y-2">
        <Label htmlFor="org-name">Organization Name</Label>
        <Input
          id="org-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Corp"
          disabled={submitting}
          autoFocus
        />
        <p className="caption text-muted-foreground">The display name for your organization</p>
      </div>

      {/* Slug Input */}
      <div className="space-y-2">
        <Label htmlFor="org-slug">Organization Slug</Label>
        <Input
          id="org-slug"
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugEdited(true);
          }}
          placeholder="acme-corp"
          disabled={submitting}
        />
        <p className="caption text-muted-foreground">Used in URLs (lowercase, hyphens allowed)</p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="body-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={submitting}
          className="flex-1"
        >
          Back
        </Button>
        <Button
          type="submit"
          disabled={!name.trim() || !slug.trim() || submitting}
          className="flex-1"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            'Create Organization'
          )}
        </Button>
      </div>
    </form>
  );
}
