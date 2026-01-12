'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CreateOrganizationFlow } from '@/app/(main)/settings/_components/organizations/create-organization-flow';
import { Building2, Github } from 'lucide-react';

type AddOrgModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type View = 'select' | 'create';

export function AddOrgModal({ open, onOpenChange }: AddOrgModalProps) {
  const router = useRouter();
  const [view, setView] = useState<View>('select');
  const [createType, setCreateType] = useState<'github' | 'standalone'>('standalone');

  const handleSelect = (type: 'standalone' | 'github') => {
    setCreateType(type);
    setView('create');
  };

  const handleSuccess = () => {
    onOpenChange(false);
    setView('select');
    router.refresh();
  };

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open);
    if (!open) {
      setView('select');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {view === 'select' ? (
          <>
            <DialogHeader>
              <DialogTitle>Add Organization</DialogTitle>
              <DialogDescription>
                Create a new organization or sync one from GitHub.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <Button
                variant="outline"
                className="h-auto p-4 justify-start gap-4"
                onClick={() => handleSelect('standalone')}
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <Building2 className="size-5" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Create Organization</div>
                  <div className="text-xs text-muted-foreground">
                    Start a new organization from scratch
                  </div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="h-auto p-4 justify-start gap-4"
                onClick={() => handleSelect('github')}
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <Github className="size-5" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Sync from GitHub</div>
                  <div className="text-xs text-muted-foreground">
                    Import an existing GitHub organization
                  </div>
                </div>
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>Create Organization</DialogTitle>
              <DialogDescription>Create a new organization</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView('select')}
                className="-ml-2"
              >
                ← Back
              </Button>
              <CreateOrganizationFlow
                key={createType}
                onSuccess={handleSuccess}
                showHeader
                initialType={createType}
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
