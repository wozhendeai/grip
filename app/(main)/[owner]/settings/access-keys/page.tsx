import { getActiveAccessKey } from '@/db/queries/access-keys';
import { getOrgMembersWithUsers, getOrgAccessKeys } from '@/db/queries/organizations';
import { auth } from '@/lib/auth/auth';
import { getSession } from '@/lib/auth/auth-server';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { AccessKeysContent } from '../_components/access-keys-content';
import type { OrgRole } from '../_lib/types';

interface AccessKeysPageProps {
  params: Promise<{ owner: string }>;
}

/**
 * Organization settings - Access Keys page
 *
 * Route: /[org-slug]/settings/access-keys
 *
 * Accessible to: owner only
 */
export default async function AccessKeysPage({ params }: AccessKeysPageProps) {
  const { owner } = await params;
  const session = await getSession();

  if (!session?.user) {
    redirect(`/login?callbackUrl=/${owner}/settings/access-keys`);
  }

  const headersList = await headers();
  const result = await auth.api.getFullOrganization({
    headers: headersList,
    query: { organizationSlug: owner },
  });

  if (!result) {
    notFound();
  }

  const membership = result.members.find((m) => m.userId === session.user.id);
  if (!membership) {
    notFound();
  }

  const currentUserRole = membership.role as OrgRole;
  if (currentUserRole !== 'owner') {
    redirect(`/${owner}/settings`);
  }

  const [ownerAccessKey, orgAccessKeys, members] = await Promise.all([
    getActiveAccessKey(session.user.id),
    getOrgAccessKeys(result.id),
    getOrgMembersWithUsers(result.id),
  ]);

  return (
    <AccessKeysContent
      ownerHasAccessKey={!!ownerAccessKey}
      orgAccessKeys={orgAccessKeys ?? []}
      members={members}
      organizationId={result.id}
    />
  );
}
