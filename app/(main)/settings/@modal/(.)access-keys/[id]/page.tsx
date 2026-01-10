import { auth } from '@/lib/auth/auth';
import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
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
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  if (!session?.user?.id) {
    redirect('/login');
  }

  const { id } = await params;
  const result = await auth.api.getAccessKey({ headers: headersList, params: { id } });

  if (!result?.accessKey) {
    notFound();
  }

  const { accessKey, keyWallet } = result;

  // Get user's passkey wallet for fetching on-chain allowance
  const { wallets } = await auth.api.listWallets({ headers: headersList });
  const rootWallet = wallets.find((w) => w.id === accessKey.rootWalletId);

  return (
    <RouteModal title="Access Key Details">
      <AccessKeyDetail
        accessKey={accessKey}
        keyWalletAddress={keyWallet?.address as `0x${string}` | undefined}
        rootWalletAddress={rootWallet?.address as `0x${string}` | undefined}
        variant="modal"
      />
    </RouteModal>
  );
}
