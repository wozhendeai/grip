import { getUserOrganizations } from '@/db/queries/users';
import { getSession } from '@/lib/auth/auth-server';
import { OrganizationsContent } from '../../../settings/_components/content/organizations-content';

export default async function OrganizationsModal() {
  const session = await getSession();
  if (!session?.user) {
    return null;
  }

  const memberships = await getUserOrganizations(session.user.id);

  return <OrganizationsContent memberships={memberships} isModal />;
}
