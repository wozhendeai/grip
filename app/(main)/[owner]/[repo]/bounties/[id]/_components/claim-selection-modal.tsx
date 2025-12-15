'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserAvatar } from '@/components/user/user-avatar';
import type { BountySubmission } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface ClaimSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissions: BountySubmission[];
  completedByUserId?: string | null;
  onSelect: (claimId: string) => void;
}

/**
 * Modal for selecting which claim to approve when multiple claims exist
 *
 * Auto-selects the PR merger's claim if available.
 * Shows all active/submitted claims with PR info and status.
 */
export function ClaimSelectionModal({
  open,
  onOpenChange,
  submissions,
  completedByUserId,
  onSelect,
}: ClaimSelectionModalProps) {
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(
    completedByUserId ? (submissions.find((c) => c.userId === completedByUserId)?.id ?? null) : null
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select Claim to Approve</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Multiple contributors claimed this bounty. Select which one to approve and pay.
          </p>
        </DialogHeader>

        <div className="space-y-2">
          {submissions.map((submission) => {
            const isPrMerger = submission.userId === completedByUserId;

            return (
              <button
                type="button"
                key={submission.id}
                onClick={() => setSelectedClaimId(submission.id)}
                className={cn(
                  'w-full rounded-lg border p-4 text-left transition-colors',
                  selectedClaimId === submission.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/50'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      user={{ name: submission.submitter.name, image: submission.submitter.image }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{submission.submitter.name}</p>
                        {isPrMerger && (
                          <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
                            PR Merged
                          </span>
                        )}
                      </div>
                      {submission.githubPrUrl && (
                        <a
                          href={submission.githubPrUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {submission.githubPrTitle || `PR #${submission.githubPrNumber}`}
                        </a>
                      )}
                    </div>
                  </div>

                  <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400">
                    {submission.status}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (selectedClaimId) {
                onSelect(selectedClaimId);
                onOpenChange(false);
              }
            }}
            disabled={!selectedClaimId}
          >
            Approve & Pay
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
