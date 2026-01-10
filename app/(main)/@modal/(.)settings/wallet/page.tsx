import { getUserDashboardStats } from '@/db/queries/bounties';
import { getSession } from '@/lib/auth/auth-server';
import { WalletContent } from '../../../settings/wallet/_components/wallet-content';

export default async function WalletSettingsModal() {
  const session = await getSession();
  if (!session?.user) {
    return null;
  }

  const stats = await getUserDashboardStats(session.user.id);

  // Wallet data is fetched client-side via tempo plugin for consistency with mutations
  return <WalletContent stats={stats} isModal />;
}
