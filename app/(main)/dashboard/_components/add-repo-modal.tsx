'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

type AddRepoModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddRepoModal({ open, onOpenChange }: AddRepoModalProps) {
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleInstall = async () => {
    setIsRedirecting(true);
    try {
      const res = await fetch('/api/github/install', { method: 'POST' });
      const data = await res.json();
      if (data.installUrl) {
        window.location.href = data.installUrl;
      }
    } catch (error) {
      console.error('Failed to get install URL:', error);
      setIsRedirecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect a Repository</DialogTitle>
          <DialogDescription>
            You'll be redirected to GitHub to install the GRIP app on your repository.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 text-xs text-muted-foreground">
          <p>After installation, you can:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Create bounties on issues</li>
            <li>Receive contributions from developers</li>
            <li>Pay out bounties with your wallet</li>
          </ul>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isRedirecting}>
            Cancel
          </Button>
          <Button onClick={handleInstall} disabled={isRedirecting}>
            {isRedirecting ? 'Redirecting...' : 'Continue to GitHub'}
            {!isRedirecting && <ExternalLink className="ml-2 size-4" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
