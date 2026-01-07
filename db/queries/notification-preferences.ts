import { db, notificationPreferences } from '@/db';
import { eq } from 'drizzle-orm';

// Default preferences for new users
const DEFAULT_PREFERENCES = {
  emailBountyFunded: true,
  emailSubmissionReceived: true,
  emailBountyCompleted: true,
  emailPayoutReceived: true,
  emailWeeklyDigest: false,
  inAppEnabled: true,
  quietHoursStart: null,
  quietHoursEnd: null,
  quietHoursTimezone: 'UTC',
} as const;

export type NotificationPreferencesRow = typeof notificationPreferences.$inferSelect;
export type NotificationPreferencesUpdate = Partial<
  Omit<NotificationPreferencesRow, 'userId' | 'updatedAt'>
>;

/**
 * Get notification preferences for a user, creating defaults if none exist.
 * This ensures users always have preferences without requiring migration.
 */
export async function getOrCreateNotificationPreferences(
  userId: string
): Promise<NotificationPreferencesRow> {
  const [existing] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);

  if (existing) return existing;

  // Create default preferences for this user
  const [created] = await db.insert(notificationPreferences).values({ userId }).returning();

  return created;
}

/**
 * Update notification preferences for a user.
 * Supports partial updates - only specified fields are changed.
 */
export async function updateNotificationPreferences(
  userId: string,
  updates: NotificationPreferencesUpdate
): Promise<NotificationPreferencesRow> {
  // Upsert: create if not exists, update if exists
  const [result] = await db
    .insert(notificationPreferences)
    .values({ userId, ...updates })
    .onConflictDoUpdate({
      target: notificationPreferences.userId,
      set: {
        ...updates,
        updatedAt: new Date().toISOString(),
      },
    })
    .returning();

  return result;
}

/**
 * Check if current time is within quiet hours.
 * Handles overnight ranges (e.g., 22:00 - 08:00).
 */
function isInQuietHours(start: string, end: string, timezone: string | null): boolean {
  const tz = timezone || 'UTC';
  const now = new Date();

  // Get current time in user's timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const currentTime = formatter.format(now);

  // Compare times as strings (HH:MM format)
  const isOvernight = start > end;

  if (isOvernight) {
    // e.g., 22:00 - 08:00: quiet if current >= 22:00 OR current < 08:00
    return currentTime >= start || currentTime < end;
  }
  // e.g., 13:00 - 15:00: quiet if current >= 13:00 AND current < 15:00
  return currentTime >= start && currentTime < end;
}
