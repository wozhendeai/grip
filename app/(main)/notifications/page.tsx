import { requireAuth } from '@/lib/auth-server';
import { getPaginatedNotifications } from '@/lib/db/queries/notifications';
import { Suspense } from 'react';
import { NotificationsList } from './_components/notifications-list';

export const metadata = {
  title: 'Notifications | BountyLane',
};

/**
 * Notifications Page - Server Component
 *
 * Full page view of all notifications with pagination.
 * Server-side rendered with client-side filtering/actions.
 *
 * Data Fetching Pattern:
 * Server component calls getPaginatedNotifications() directly (no API route).
 * This follows BountyLane's convention: "Server functions for reads, API routes for mutations."
 */
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string }>;
}) {
  const session = await requireAuth();
  const resolvedParams = await searchParams;
  const page = Number.parseInt(resolvedParams.page ?? '1', 10);
  const limit = 20;
  const offset = (page - 1) * limit;
  const unreadOnly = resolvedParams.filter === 'unread';

  const { notifications, total } = await getPaginatedNotifications(session.user.id, {
    limit,
    offset,
    unreadOnly,
  });

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="container max-w-4xl py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="heading-1">Notifications</h1>
      </div>

      <Suspense fallback={<div>Loading...</div>}>
        <NotificationsList
          notifications={notifications}
          currentPage={page}
          totalPages={totalPages}
          unreadOnly={unreadOnly}
        />
      </Suspense>
    </div>
  );
}
