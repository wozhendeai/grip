import { auth } from '@/lib/auth/auth';
import { getSession } from '@/lib/auth/auth-server';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { MembersContent } from '../_components/members-content';
import type { OrgInvitation, OrgMember, OrgRole } from '../_lib/types';

interface MembersPageProps {
  params: Promise<{ owner: string }>;
}

/**
 * Organization settings - Members page
 *
 * Route: /[org-slug]/settings/members
 *
 * Accessible to: owner, bountyManager
 */
export default async function MembersPage({ params }: MembersPageProps) {
  const { owner } = await params;
  const session = await getSession();

  if (!session?.user) {
    redirect(`/login?callbackUrl=/${owner}/settings/members`);
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
  const canManageMembers = currentUserRole === 'owner' || currentUserRole === 'bountyManager';

  if (!canManageMembers) {
    redirect(`/${owner}/settings`);
  }

  // Transform getFullOrganization members to OrgMember type
  // No wallet data needed for members list display
  const members: OrgMember[] = result.members.map((m) => ({
    id: m.id,
    role: m.role,
    sourceType: m.sourceType ?? null,
    createdAt: m.createdAt,
    user: m.user
      ? {
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          image: m.user.image ?? null,
        }
      : null,
  }));

  // Filter to pending invitations only
  const pendingInvitations: OrgInvitation[] = result.invitations
    .filter((inv) => inv.status === 'pending')
    .map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role as OrgRole,
      status: inv.status as 'pending',
      expiresAt: inv.expiresAt,
      inviterId: inv.inviterId,
    }));

  return (
    <MembersContent
      members={members}
      invitations={pendingInvitations}
      organizationId={result.id}
      currentUserRole={currentUserRole}
    />
  );
}
