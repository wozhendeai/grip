import { auth } from '@/lib/auth/auth';
import { getSession } from '@/lib/auth/auth-server';
import { headers } from 'next/headers';
import type { Organization, OrgRole, OrgSettingsContext } from './types';

export interface OrgSettingsLayoutData {
  organization: Organization;
  currentUserRole: OrgRole;
  context: OrgSettingsContext;
  userId: string;
}

/**
 * Fetches data required for org settings layout (sidebar + access control).
 * Returns null if user is not authenticated, org doesn't exist, or user is not a member.
 */
export async function getOrgSettingsLayoutData(
  ownerSlug: string
): Promise<OrgSettingsLayoutData | null> {
  const session = await getSession();
  if (!session?.user) {
    return null;
  }

  const headersList = await headers();
  const result = await auth.api.getFullOrganization({
    headers: headersList,
    query: { organizationSlug: ownerSlug },
  });

  if (!result) {
    return null;
  }

  // Find current user's membership
  const membership = result.members.find((m) => m.userId === session.user.id);
  if (!membership) {
    return null;
  }

  // Cast to access custom fields (better-auth types don't include additionalFields)
  const org = result as typeof result & {
    githubOrgLogin?: string | null;
    syncMembership?: boolean;
    lastSyncedAt?: Date | null;
  };

  const currentUserRole = membership.role as OrgRole;
  const isOwner = currentUserRole === 'owner';
  const canViewWallet = isOwner || currentUserRole === 'billingAdmin';
  const canManageMembers = isOwner || currentUserRole === 'bountyManager';
  const hasGitHubSync = !!org.githubOrgLogin;

  const organization: Organization = {
    id: org.id,
    name: org.name,
    slug: org.slug,
    logo: org.logo ?? null,
    githubOrgLogin: org.githubOrgLogin ?? null,
    syncMembership: org.syncMembership ?? false,
    lastSyncedAt: org.lastSyncedAt ?? null,
    createdAt: org.createdAt,
  };

  return {
    organization,
    currentUserRole,
    userId: session.user.id,
    context: {
      organization,
      currentUserRole,
      isOwner,
      canViewWallet,
      canManageMembers,
      hasGitHubSync,
    },
  };
}
