'use client';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useRouter } from 'next/navigation';

interface RouteModalProps {
  children: React.ReactNode;
  /** Accessible title for screen readers (hidden visually) */
  title?: string;
}

/**
 * Modal wrapper for intercepted routes
 *
 * Used with Next.js parallel routes to show content in a modal
 * when navigating within the app, while still supporting direct URLs.
 *
 * Closes on:
 * - Clicking overlay
 * - Pressing Escape
 * - Calling router.back()
 *
 * Note: DialogContent internally renders DialogOverlay, so we don't need
 * to render it separately here.
 */
export function RouteModal({ children, title = 'Modal' }: RouteModalProps) {
  const router = useRouter();

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      router.back();
    }
  };

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-auto p-0">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
