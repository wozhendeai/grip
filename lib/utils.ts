import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate an array of items with stable IDs for skeleton loaders
 *
 * Avoids using array index as React key (biome lint rule).
 * Each skeleton item gets a stable, unique key like 'skeleton-0', 'skeleton-1'.
 *
 * @param count - Number of skeleton items to render
 * @returns Array of objects with stable 'id' property
 *
 * @example
 * {skeletonItems(5).map(({ id }) => (
 *   <BountyListItemSkeleton key={id} />
 * ))}
 */
export function skeletonItems(count: number): Array<{ id: string }> {
  return Array.from({ length: count }, (_, i) => ({ id: `skeleton-${i}` }));
}

/**
 * Format a date as a relative time string
 *
 * Converts timestamps to human-readable relative times like "2m ago", "5h ago", "3d ago"
 * Used for displaying activity timestamps, last active times, etc.
 *
 * @param date - The date to format
 * @returns Formatted relative time string
 *
 * @example
 * formatTimeAgo(new Date(Date.now() - 120000)) // "2m ago"
 * formatTimeAgo(new Date(Date.now() - 7200000)) // "2h ago"
 */
export function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

/**
 * Map notification types to emoji icons
 *
 * Used in dropdown and full page notification displays.
 * Icons provide visual distinction between notification types.
 */
export const NOTIFICATION_ICONS: Record<string, string> = {
  pr_submitted: '🟢',
  claim_expiring: '🟡',
  payment_received: '💰',
  bounty_created_on_repo: '🆕',
  pr_approved: '✅',
  pr_rejected: '❌',
  claim_expired: '⏰',
} as const;
