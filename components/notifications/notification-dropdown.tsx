'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Notification } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useSession } from '@/lib/auth/auth-client';
import { Bell, Inbox } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

/**
 * Format timestamp as relative time
 *
 * "2 minutes ago", "5 hours ago", "3 days ago"
 * Falls back to toLocaleDateString for older dates
 */
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

/**
 * Notification Bell Dropdown
 *
 * Shows in navbar with unread count badge.
 * Polls /api/notifications every 15 seconds.
 *
 * Design decisions:
 * - 15s polling over WebSocket: Simpler, adequate for bounty workflow
 * - Badge shows unread count (0-99+)
 * - Dropdown shows 5 most recent (unread first)
 * - Clicking notification marks as read + navigates
 */
export function NotificationDropdown() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  // Fetch recent notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) return;

      const data = await res.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, []);

  // Initial fetch + polling (only when logged in)
  useEffect(() => {
    if (!session?.user) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15_000); // 15 seconds
    return () => clearInterval(interval);
  }, [fetchNotifications, session?.user]);

  // Only show when logged in
  if (!session?.user) return null;

  // Mark as read when clicked
  const handleNotificationClick = async (notificationId: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [notificationId] }),
      });
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger
        render={<Button variant="ghost" className="relative h-9 w-9 rounded-full" />}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-xs font-medium text-destructive-foreground">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-sm font-medium">Notifications</span>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Notifications List */}
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Inbox className="h-8 w-8 mb-2 opacity-50" />
            <span className="text-sm">No notifications</span>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((notification) => (
              <Link
                key={notification.id}
                href={notification.linkUrl}
                onClick={() => handleNotificationClick(notification.id)}
                className={cn(
                  'flex items-start gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0',
                  !notification.readAt && 'bg-accent/30'
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug line-clamp-1">
                    {notification.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {notification.message}
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    {formatTimeAgo(notification.createdAt)}
                  </p>
                </div>
                {!notification.readAt && (
                  <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                )}
              </Link>
            ))}
          </div>
        )}

        {/* Footer */}
        {notifications.length > 0 && (
          <Link
            href="/notifications"
            className="block px-3 py-2 text-center text-xs text-muted-foreground hover:text-foreground border-t border-border transition-colors"
          >
            View all
          </Link>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
