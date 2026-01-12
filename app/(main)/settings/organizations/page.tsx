import { getUserOrganizations } from '@/db/queries/users';
import { getSession } from '@/lib/auth/auth-server';
import { OrganizationsContent } from '../_components/content/organizations-content';

type PageProps = {
  searchParams: Promise<{ create?: string }>;
};

export default async function OrganizationsPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session?.user) {
    return null;
  }

  const [memberships, params] = await Promise.all([
    getUserOrganizations(session.user.id),
    searchParams,
  ]);

  const initialCreateType = params.create === 'github' || params.create === 'standalone'
    ? params.create
    : undefined;

  return <OrganizationsContent memberships={memberships} initialCreateType={initialCreateType} />;
}
