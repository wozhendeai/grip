import { getSession } from '@/lib/auth/auth-server';
import { getAccessKeyByIdForUser } from '@/db/queries/access-keys';
import { redirect, notFound } from 'next/navigation';
import { RouteModal } from '@/components/layout/route-modal';
import { AccessKeyDetail } from '../../../_components/access-key-detail';

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * Intercepted route for access key detail modal.
 * Shows access key details in a modal when navigating within the app.
 * Direct URL navigation shows the full page version instead.
 */
export default async function AccessKeyDetailModal({ params }: Props) {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const { id } = await params;
  const accessKey = await getAccessKeyByIdForUser(id, session.user.id);

  if (!accessKey) {
    notFound();
  }

  // Format the access key data for the component
  const formattedKey = {
    id: accessKey.id,
    label: accessKey.label,
    backendWalletAddress: accessKey.backendWalletAddress,
    status: accessKey.status,
    createdAt: accessKey.createdAt,
    expiry: accessKey.expiry,
    limits: accessKey.limits as Record<string, { initial: string; remaining: string }>,
    lastUsedAt: accessKey.lastUsedAt,
  };

  return (
    <RouteModal title="Access Key Details">
      <AccessKeyDetail accessKey={formattedKey} variant="modal" />
    </RouteModal>
  );
}
