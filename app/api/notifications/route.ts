import {
  getRecentNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
} from '@/db/queries/notifications';
import { requireAuth } from '@/lib/auth/auth-server';
import { handleRouteError, validateBody } from '@/app/api/_lib';
import { z } from 'zod';
import type { NextRequest } from 'next/server';

const markReadSchema = z
  .object({
    all: z.boolean().optional(),
    ids: z.array(z.string()).optional(),
  })
  .refine((data) => data.all || (data.ids && data.ids.length > 0), {
    message: 'Must specify either all: true or ids array',
  });

/**
 * GET /api/notifications
 *
 * Returns recent notifications + unread count.
 * Optimized for quick navbar badge updates via polling.
 */
export async function GET() {
  try {
    const session = await requireAuth();

    const [notifications, unreadCount] = await Promise.all([
      getRecentNotifications(session.user.id, 5),
      getUnreadCount(session.user.id),
    ]);

    return Response.json({ notifications, unreadCount });
  } catch (error) {
    return handleRouteError(error, 'fetching notifications');
  }
}

/**
 * PATCH /api/notifications
 *
 * Mark notifications as read.
 * Body: { all: true } or { ids: string[] }
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await validateBody(request, markReadSchema);

    if (body.all) {
      await markAllAsRead(session.user.id);
    } else if (body.ids) {
      await Promise.all(body.ids.map((id) => markAsRead(id, session.user.id)));
    }

    return Response.json({ success: true });
  } catch (error) {
    return handleRouteError(error, 'marking notifications read');
  }
}
