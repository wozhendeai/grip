'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Notification } from '@/lib/types';
import { NOTIFICATION_ICONS } from '@/lib/utils';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

/**
 * Format timestamp as relative time
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

interface NotificationsListProps {
  notifications: Notification[];
  currentPage: number;
  totalPages: number;
  unreadOnly: boolean;
}

/**
 * Notifications List - Client Component
 *
 * Handles filtering, pagination, and mark-as-read actions.
 * Receives initial data from server component, manages interactions client-side.
 */
export function NotificationsList({
  notifications: initialNotifications,
  currentPage,
  totalPages,
  unreadOnly,
}: NotificationsListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [notifications, setNotifications] = useState(initialNotifications);

  // Filter change
  const handleFilterChange = (filter: string) => {
    const params = new URLSearchParams(searchParams);
    if (filter === 'all') {
      params.delete('filter');
    } else {
      params.set('filter', filter);
    }
    params.delete('page'); // Reset to page 1
    router.push(`/notifications?${params.toString()}`);
  };

  // Mark as read on click
  const handleNotificationClick = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PUT',
      });
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, readAt: new Date().toISOString() } : n))
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    try {
      await fetch('/api/notifications/read-all', {
        method: 'PUT',
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  // Pagination
  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    router.push(`/notifications?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Filters + Mark All */}
      <div className="flex items-center justify-between">
        <Tabs value={unreadOnly ? 'unread' : 'all'} onValueChange={handleFilterChange}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread only</TabsTrigger>
          </TabsList>
        </Tabs>

        <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead}>
          Mark all as read
        </Button>
      </div>

      {/* Notifications */}
      {notifications.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">No notifications to display</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <Link
              key={notification.id}
              href={notification.linkUrl}
              onClick={() => handleNotificationClick(notification.id)}
              className={`block p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors ${
                !notification.readAt ? 'bg-accent/30' : ''
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <span className="text-3xl shrink-0">{NOTIFICATION_ICONS[notification.type]}</span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">{notification.title}</p>
                      <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                    </div>

                    {/* Time + Unread badge */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimeAgo(notification.createdAt)}
                      </span>
                      {!notification.readAt && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => goToPage(currentPage - 1)}
          >
            Previous
          </Button>

          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => goToPage(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
