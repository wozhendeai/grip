import { db, notifications } from '@/db';
import type { Notification, NotificationMetadata } from '@/lib/types';
import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';

/**
 * Notification Query Functions
 *
 * Database queries for the notifications system. Optimized with indexes:
 * - Partial index on unread notifications (WHERE read_at IS NULL)
 * - Composite index on (user_id, created_at DESC) for pagination
 */

/**
 * Get unread notification count for user
 *
 * Used for navbar badge display.
 * Optimized with partial index on (user_id, read_at, created_at DESC) WHERE read_at IS NULL
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));

  return result?.count ?? 0;
}

/**
 * Get recent notifications for dropdown (3-5 most recent)
 *
 * Returns unread first, then most recent overall.
 * Used by notification dropdown component for polling.
 */
export async function getRecentNotifications(userId: string, limit = 5): Promise<Notification[]> {
  const results = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(
      // Unread first (NULL sorts last in Postgres, so we use CASE to make NULL sort first)
      sql`CASE WHEN ${notifications.readAt} IS NULL THEN 0 ELSE 1 END`,
      desc(notifications.createdAt)
    )
    .limit(limit);

  return results.map((r) => ({
    ...r,
    metadata: r.metadata as NotificationMetadata,
  })) as Notification[];
}

/**
 * Get paginated notifications for full page view
 *
 * Supports filtering by read/unread status.
 * Returns both the notifications and total count for pagination.
 */
export async function getPaginatedNotifications(
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
  } = {}
): Promise<{ notifications: Notification[]; total: number }> {
  const { limit = 50, offset = 0, unreadOnly = false } = options;

  // Build where condition
  const whereCondition = unreadOnly
    ? and(eq(notifications.userId, userId), isNull(notifications.readAt))
    : eq(notifications.userId, userId);

  // Get total count
  const [{ total }] = await db.select({ total: count() }).from(notifications).where(whereCondition);

  // Get paginated results
  const results = await db
    .select()
    .from(notifications)
    .where(whereCondition)
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    notifications: results.map((r) => ({
      ...r,
      metadata: r.metadata as NotificationMetadata,
    })) as Notification[],
    total: total ?? 0,
  };
}

/**
 * Mark notification as read
 *
 * Sets the readAt timestamp to current time.
 * Only updates if notification belongs to the specified user (security).
 */
export async function markAsRead(notificationId: string, userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date().toISOString() })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
}

/**
 * Mark all notifications as read for user
 *
 * Bulk operation for "Mark all read" button.
 * Only updates unread notifications (readAt IS NULL).
 */
export async function markAllAsRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date().toISOString() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}

/**
 * Create a notification
 *
 * Internal helper - prefer using NotificationService.create() for type safety.
 * This is the low-level database insert function.
 */
export async function createNotification(input: {
  userId: string;
  type: string;
  title: string;
  message: string;
  linkUrl: string;
  metadata: Record<string, unknown>;
}): Promise<Notification> {
  const [notification] = await db.insert(notifications).values(input).returning();

  return {
    ...notification,
    metadata: notification.metadata as NotificationMetadata,
  } as Notification;
}
