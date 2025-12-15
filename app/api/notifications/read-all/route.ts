import { requireAuth } from '@/lib/auth-server';
import { markAllAsRead } from '@/lib/db/queries/notifications';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * PUT /api/notifications/read-all
 *
 * Mark all unread notifications as read for the authenticated user.
 * Bulk operation for "Mark all read" button.
 *
 * Response: { success: true }
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth();

    await markAllAsRead(session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error marking all as read:', error);
    return NextResponse.json({ error: 'Failed to mark all as read' }, { status: 500 });
  }
}
