'use client';

import { GitBranch, Sparkles } from 'lucide-react';

/**
 * OrganizationTypeSelector - Step 1 of organization creation
 *
 * Two-button choice between:
 * - GitHub-linked: Import from existing GitHub org
 * - Standalone: Create from scratch, invite manually
 *
 * Design: Large clickable cards with icons, headings, and descriptions
 */

type OrganizationTypeSelectorProps = {
  onSelectType: (type: 'github' | 'standalone') => void;
};

export function OrganizationTypeSelector({ onSelectType }: OrganizationTypeSelectorProps) {
  return (
    <div className="space-y-4">
      {/* GitHub Option */}
      <button
        onClick={() => onSelectType('github')}
        type="button"
        className="w-full p-4 border-2 border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-all text-left"
      >
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <GitBranch className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold">Link GitHub Organization</h3>
            <p className="caption text-muted-foreground mt-1">
              Import from an existing GitHub org you admin
            </p>
          </div>
        </div>
      </button>

      {/* Standalone Option */}
      <button
        onClick={() => onSelectType('standalone')}
        type="button"
        className="w-full p-4 border-2 border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-all text-left"
      >
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold">Create Standalone</h3>
            <p className="caption text-muted-foreground mt-1">Start fresh, invite users manually</p>
          </div>
        </div>
      </button>
    </div>
  );
}
