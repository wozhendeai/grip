'use client';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

interface RouteModalProps {
  children: React.ReactNode;
  /** Accessible title for screen readers (hidden visually) */
  title?: string;
  /**
   * Explicit close destination. If not provided, uses `from` search param,
   * then falls back to "/". Deterministic targets prevent redirect loops.
   */
  closePath?: string;
  /** Whether to use router.back() instead of replace (for content previews) */
  useBack?: boolean;
  /** Animation duration in ms before navigation */
  animationMs?: number;
}

/**
 * Modal wrapper for intercepted routes
 *
 * Used with Next.js parallel routes to show content in a modal
 * when navigating within the app, while still supporting direct URLs.
 *
 * Close behavior:
 * - useBack=true: Uses router.back() (good for content previews)
 * - useBack=false: Uses router.replace() to deterministic target (good for auth)
 *
 * The @modal/[...catchAll]/page.tsx returning null is required for
 * router.replace() to actually clear the modal slot on soft navigation.
 */
export function RouteModal({
  children,
  title = 'Modal',
  closePath,
  useBack = false,
  animationMs = 150,
}: RouteModalProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(true);

  // Deterministic close target: explicit path > callbackUrl/from param > fallback
  const from = searchParams.get('callbackUrl') ?? searchParams.get('from') ?? undefined;
  const target = closePath ?? from ?? '/';

  const close = useCallback(() => {
    if (useBack) {
      router.back();
    } else {
      router.replace(target);
    }
  }, [router, target, useBack]);

  // Navigate after dialog close animation completes
  useEffect(() => {
    if (isOpen) return;
    const timeout = setTimeout(close, animationMs);
    return () => clearTimeout(timeout);
  }, [isOpen, close, animationMs]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && setIsOpen(false)}>
      <DialogContent className="max-h-[90vh] sm:max-w-6xl overflow-auto p-0">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
