import {
  getBountiesCreatedByUser,
  getCompletedBountiesByUser,
  getUserDashboardStats,
} from '@/db/queries/bounties';
import { getSession } from '@/lib/auth/auth-server';
import { ActivityContent } from '../../../settings/_components/content/activity-content';

export default async function ActivityModal() {
  const session = await getSession();
  if (!session?.user) {
    return null;
  }

  const [stats, bounties, contributions] = await Promise.all([
    getUserDashboardStats(session.user.id),
    getBountiesCreatedByUser(session.user.id),
    getCompletedBountiesByUser(session.user.id),
  ]);

  return (
    <ActivityContent stats={stats} bounties={bounties} contributions={contributions} isModal />
  );
}
