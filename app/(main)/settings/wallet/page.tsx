import { getPasskeysByUser } from '@/db/queries/passkeys';
import { getSession } from '@/lib/auth/auth-server';
import { WalletContent } from '../_components/content/wallet-content';

export default async function WalletSettingsPage() {
  const session = await getSession();
  if (!session?.user) {
    return null;
  }

  const passkeys = await getPasskeysByUser(session.user.id);
  const walletPasskey = passkeys.find((p) => p.tempoAddress) ?? null;
  const wallet = walletPasskey
    ? {
        id: walletPasskey.id,
        name: walletPasskey.name,
        tempoAddress: walletPasskey.tempoAddress,
        createdAt: walletPasskey.createdAt?.toISOString() ?? new Date().toISOString(),
      }
    : null;

  return <WalletContent wallet={wallet} isModal={false} />;
}
