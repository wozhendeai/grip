import { getUserDashboardStats } from '@/db/queries/bounties';
import { getPasskeysByUser } from '@/db/queries/passkeys';
import { getSession } from '@/lib/auth/auth-server';
import { WalletContent } from './_components/wallet-content';

export default async function WalletSettingsPage() {
  const session = await getSession();
  if (!session?.user) {
    return null;
  }

  const [passkeys, stats] = await Promise.all([
    getPasskeysByUser(session.user.id),
    getUserDashboardStats(session.user.id),
  ]);

  const walletPasskey = passkeys.find((p) => p.tempoAddress) ?? null;
  const wallet = walletPasskey?.tempoAddress
    ? {
        id: walletPasskey.id,
        name: walletPasskey.name,
        tempoAddress: walletPasskey.tempoAddress as `0x${string}`,
        createdAt: walletPasskey.createdAt?.toISOString() ?? new Date().toISOString(),
      }
    : null;

  return <WalletContent wallet={wallet} stats={stats} />;
}
