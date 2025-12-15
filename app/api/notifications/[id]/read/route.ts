import { requireAuth } from '@/lib/auth-server';
import { markAsRead } from '@/lib/db/queries/notifications';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * PUT /api/notifications/[id]/read
 *
 * Mark a single notification as read.
 * Validates that the notification belongs to the authenticated user.
 *
 * Response: { success: true }
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    await markAsRead(id, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error marking notification as read:', error);
    return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 });
  }
}
