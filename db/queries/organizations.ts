import { db } from '@/db';
import { networkFilter } from '../network';
import { accessKeys } from '@/db/schema/business';
import { member, passkey } from '@/db/schema/auth';
import { and, eq, sql } from 'drizzle-orm';

// ============================================================================
// ORGANIZATION WALLET
// ============================================================================

/**
 * Get organization wallet address (owner's passkey address)
 */
export async function getOrgWalletAddress(orgId: string): Promise<`0x${string}`> {
  const owner = await db.query.member.findFirst({
    where: and(eq(member.organizationId, orgId), eq(member.role, 'owner')),
    with: {
      user: {
        with: { passkeys: true },
      },
    },
  });

  if (!owner?.user?.passkeys?.[0]?.tempoAddress) {
    throw new Error('Organization owner has no passkey with Tempo address');
  }

  return owner.user.passkeys[0].tempoAddress as `0x${string}`;
}

// ============================================================================
// MEMBERSHIP
// ============================================================================

export async function isOrgOwner(orgId: string, userId: string): Promise<boolean> {
  const membership = await db.query.member.findFirst({
    where: and(eq(member.organizationId, orgId), eq(member.userId, userId)),
  });
  return membership?.role === 'owner';
}

export async function isOrgMember(orgId: string, userId: string): Promise<boolean> {
  const membership = await db.query.member.findFirst({
    where: and(eq(member.organizationId, orgId), eq(member.userId, userId)),
  });
  return !!membership;
}

export async function getOrgMembership(orgId: string, userId: string) {
  return db.query.member.findFirst({
    where: and(eq(member.organizationId, orgId), eq(member.userId, userId)),
  });
}

// ============================================================================
// ORG ACCESS KEYS
// ============================================================================

/**
 * Get active Access Key for org team member
 */
export async function getOrgAccessKey(orgId: string, teamMemberUserId: string) {
  const teamMemberPasskey = await db.query.passkey.findFirst({
    where: eq(passkey.userId, teamMemberUserId),
  });

  if (!teamMemberPasskey) return null;

  return db.query.accessKeys.findFirst({
    where: and(
      eq(accessKeys.organizationId, orgId),
      eq(accessKeys.authorizedUserPasskeyId, teamMemberPasskey.id),
      eq(accessKeys.status, 'active'),
      networkFilter(accessKeys)
    ),
  });
}

/**
 * Get all Access Keys for an organization
 */
export async function getOrgAccessKeys(orgId: string) {
  const { user } = await import('@/db/schema/auth');

  return db
    .select({
      id: accessKeys.id,
      organizationId: accessKeys.organizationId,
      network: accessKeys.network,
      authorizedUserPasskeyId: accessKeys.authorizedUserPasskeyId,
      keyType: accessKeys.keyType,
      chainId: accessKeys.chainId,
      expiry: accessKeys.expiry,
      limits: accessKeys.limits,
      status: accessKeys.status,
      createdAt: accessKeys.createdAt,
      label: accessKeys.label,
      user: {
        id: user.id,
        name: user.name,
      },
    })
    .from(accessKeys)
    .leftJoin(passkey, eq(accessKeys.authorizedUserPasskeyId, passkey.id))
    .leftJoin(user, eq(passkey.userId, user.id))
    .where(and(eq(accessKeys.organizationId, orgId), networkFilter(accessKeys)))
    .orderBy(accessKeys.createdAt);
}

/**
 * Validate team member can spend from org
 */
export async function validateOrgSpending(params: {
  orgId: string;
  teamMemberUserId: string;
  tokenAddress: string;
  amount: bigint;
}): Promise<{ valid: boolean; error?: string; accessKey?: typeof accessKeys.$inferSelect }> {
  const accessKey = await getOrgAccessKey(params.orgId, params.teamMemberUserId);

  if (!accessKey) {
    return { valid: false, error: 'No active Access Key for this organization' };
  }

  if (accessKey.expiry && BigInt(accessKey.expiry) < BigInt(Math.floor(Date.now() / 1000))) {
    return { valid: false, error: 'Access Key has expired' };
  }

  const limits = accessKey.limits as Record<string, { initial: string; remaining: string }>;
  const tokenLimit = limits[params.tokenAddress];

  if (!tokenLimit) {
    return { valid: false, error: 'Token not authorized for this Access Key' };
  }

  if (BigInt(tokenLimit.remaining) < params.amount) {
    return {
      valid: false,
      error: `Insufficient spending limit. Remaining: ${tokenLimit.remaining}`,
    };
  }

  return { valid: true, accessKey };
}

// ============================================================================
// ORGANIZATION PROFILES
// ============================================================================

/**
 * Get GRIP organization by slug
 *
 * Used for route resolution at /:slug
 * Returns null if org doesn't exist with this slug
 */
export async function getOrgBySlug(slug: string) {
  const { organization } = await import('@/db/schema/auth');

  return db.query.organization.findFirst({
    where: eq(organization.slug, slug),
    with: {
      members: {
        with: {
          user: true,
        },
      },
    },
  });
}

/**
 * Get organization bounty data (funded bounties + stats)
 * Similar to getBountyDataByGitHubId but for orgs
 */
export async function getOrgBountyData(orgId: string) {
  const { bounties } = await import('@/db/schema/business');

  // Get bounties funded/created by organization
  const funded = await db
    .select({
      id: bounties.id,
      title: bounties.title,
      amount: bounties.totalFunded,
      status: bounties.status,
      githubOwner: bounties.githubOwner,
      githubRepo: bounties.githubRepo,
      githubIssueNumber: bounties.githubIssueNumber,
      createdAt: bounties.createdAt,
    })
    .from(bounties)
    .where(and(networkFilter(bounties), eq(bounties.organizationId, orgId)))
    .orderBy(bounties.createdAt);

  const totalFunded = funded.reduce((sum, b) => sum + BigInt(b.amount), BigInt(0));

  return {
    funded,
    totalFunded,
    fundedCount: funded.length,
  };
}

/**
 * Get org members with their GRIP user data
 */
export async function getOrgMembersWithUsers(orgId: string) {
  return db.query.member.findMany({
    where: eq(member.organizationId, orgId),
    with: {
      user: {
        with: {
          passkeys: true,
        },
      },
    },
    orderBy: member.createdAt,
  });
}

/**
 * Get repositories with GRIP activity for an organization
 *
 * Returns:
 * 1. Repos that have bounties created by this org OR bounties funded by this org
 * 2. Repos that are owned by this org (matched by githubLogin) and have repo_settings (installed)
 */
export async function getOrgRepositories(orgId: string, githubLogin: string | null) {
  const { bounties, repoSettings } = await import('@/db/schema/business');

  // 1. Get repos with bounties linked to this org
  const bountyRepos = await db
    .select({
      id: bounties.githubRepoId,
      owner: bounties.githubOwner,
      name: bounties.githubRepo,
      bountyCount: sql<number>`count(${bounties.id})`.mapWith(Number),
      totalFunded: sql<bigint>`sum(${bounties.totalFunded})`.mapWith(BigInt),
    })
    .from(bounties)
    .where(and(networkFilter(bounties), eq(bounties.organizationId, orgId)))
    .groupBy(bounties.githubRepoId, bounties.githubOwner, bounties.githubRepo);

  // 2. Get repos owned by this org that have settings (installed)
  // Only if we know the GitHub login
  let installedRepos: typeof bountyRepos = [];
  if (githubLogin) {
    // We need to match column selection for union/merge
    // Note: repo_settings doesn't store aggregate stats, so we zero them here
    // We'll merge stats later if they exist in both lists
    const installed = await db
      .select({
        id: repoSettings.githubRepoId,
        owner: repoSettings.githubOwner,
        name: repoSettings.githubRepo,
        bountyCount: sql<number>`0`.mapWith(Number),
        totalFunded: sql<bigint>`0`.mapWith(BigInt),
      })
      .from(repoSettings)
      .where(eq(repoSettings.githubOwner, githubLogin));

    // @ts-ignore - type compatibility of sql mapping
    installedRepos = installed;
  }

  // Merge results
  const repoMap = new Map<string, (typeof bountyRepos)[0]>();

  // Add bounty repos first (they have stats)
  for (const repo of bountyRepos) {
    repoMap.set(repo.id.toString(), repo);
  }

  // Add/merge installed repos
  for (const repo of installedRepos) {
    const key = repo.id.toString();
    if (!repoMap.has(key)) {
      repoMap.set(key, repo);
    }
    // If it exists, we keep the one with stats (bountyRepos)
    // Implicitly handled since we started with bountyRepos and only add if missing
  }

  return Array.from(repoMap.values()).sort((a, b) => {
    // Sort by funded amount desc, then name
    const diff = b.totalFunded - a.totalFunded;
    if (diff !== 0n) return diff > 0n ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}
