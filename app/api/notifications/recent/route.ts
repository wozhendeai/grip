import { requireAuth } from '@/lib/auth-server';
import { getRecentNotifications, getUnreadCount } from '@/lib/db/queries/notifications';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/notifications/recent
 *
 * Returns 5 most recent notifications for dropdown.
 * Optimized for quick navbar badge updates via 15-second polling.
 *
 * Response: { notifications: Notification[], unreadCount: number }
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    const [notifications, unreadCount] = await Promise.all([
      getRecentNotifications(session.user.id, 5),
      getUnreadCount(session.user.id),
    ]);

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching recent notifications:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}
