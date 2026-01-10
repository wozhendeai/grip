import { auth } from '@/lib/auth/auth';
import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { AccessKeyDetailContent } from '../../../../settings/_components/content/access-key-detail-content';

interface Props {
  params: Promise<{ id: string }>;
}

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
    <AccessKeyDetailContent
      accessKey={accessKey}
      keyWalletAddress={keyWallet?.address as `0x${string}` | undefined}
      rootWalletAddress={rootWallet?.address as `0x${string}` | undefined}
      variant="modal"
    />
  );
}
