import { auth } from '@/lib/auth/auth';
import { headers } from 'next/headers';
import { AccessKeysContent } from '../../../settings/_components/content/access-keys-content';

export default async function AccessKeysModal() {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  if (!session?.user) {
    return null;
  }

  // Get wallets and access keys from plugin API
  const { wallets } = await auth.api.listWallets({ headers: headersList });
  const passkeyWallet = wallets.find((w) => w.walletType === 'passkey') ?? null;

  if (!passkeyWallet) {
    return <AccessKeysContent hasWallet={false} accessKeys={[]} />;
  }

  const { accessKeys } = await auth.api.listAccessKeys({ headers: headersList });

  return <AccessKeysContent hasWallet={true} accessKeys={accessKeys} />;
}
