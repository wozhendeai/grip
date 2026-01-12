'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CreateOrganizationFlow } from './create-organization-flow';

/**
 * CreateOrganizationModal - Dialog wrapper for organization creation
 *
 * Uses CreateOrganizationFlow for the actual creation logic.
 * Use this for full-page settings; for modal settings use CreateOrganizationFlow inline.
 */

type CreateOrganizationModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  initialType?: 'github' | 'standalone';
};

export function CreateOrganizationModal({
  open,
  onOpenChange,
  onSuccess,
  initialType,
}: CreateOrganizationModalProps) {
  function handleSuccess() {
    onSuccess?.();
    onOpenChange(false);
  }

  function handleOpenChange(open: boolean) {
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="sr-only">
          <DialogTitle>Create Organization</DialogTitle>
          <DialogDescription>Create a new organization</DialogDescription>
        </DialogHeader>
        <CreateOrganizationFlow
          key={initialType ?? 'default'}
          onSuccess={handleSuccess}
          showHeader
          initialType={initialType}
        />
      </DialogContent>
    </Dialog>
  );
}
