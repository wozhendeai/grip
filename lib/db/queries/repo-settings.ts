import { bounties, db, repoSettings } from '@/db';
import { and, desc, eq, sql } from 'drizzle-orm';

export type CreateRepoSettingsInput = {
  verifiedOwnerUserId: string;
  githubRepoId: bigint | string;
  githubOwner: string;
  githubRepo: string;
};

/**
 * Create repo settings (repo owner verification)
 *
 * Only verified GitHub repo owners can create settings.
 * This enables requireOwnerApproval flag for their repo.
 */
export async function createRepoSettings(input: CreateRepoSettingsInput) {
  const githubRepoId =
    typeof input.githubRepoId === 'string' ? BigInt(input.githubRepoId) : input.githubRepoId;

  const [settings] = await db
    .insert(repoSettings)
    .values({
      githubRepoId,
      githubOwner: input.githubOwner,
      githubRepo: input.githubRepo,
      verifiedOwnerUserId: input.verifiedOwnerUserId,
      verifiedAt: new Date().toISOString(),
    })
    .returning();

  return settings;
}

/**
 * Get repo settings by GitHub repo ID (primary key)
 */
export async function getRepoSettingsByGithubRepoId(githubRepoId: bigint | string) {
  const repoIdBigInt = typeof githubRepoId === 'string' ? BigInt(githubRepoId) : githubRepoId;

  const [settings] = await db
    .select()
    .from(repoSettings)
    .where(eq(repoSettings.githubRepoId, repoIdBigInt))
    .limit(1);

  return settings ?? null;
}

/**
 * Get repo settings by owner/repo name
 */
export async function getRepoSettingsByName(owner: string, repo: string) {
  const [settings] = await db
    .select()
    .from(repoSettings)
    .where(and(eq(repoSettings.githubOwner, owner), eq(repoSettings.githubRepo, repo)))
    .limit(1);

  return settings ?? null;
}

/**
 * Get all repos owned by user (verified owner)
 */
export async function getRepoSettingsByUser(userId: string) {
  return db.select().from(repoSettings).where(eq(repoSettings.verifiedOwnerUserId, userId));
}

/**
 * Update webhook config for repo
 */
export async function updateRepoWebhook(
  githubRepoId: bigint | string,
  webhookId: bigint | string,
  webhookSecret: string
) {
  const repoIdBigInt = typeof githubRepoId === 'string' ? BigInt(githubRepoId) : githubRepoId;
  const webhookIdBigInt = typeof webhookId === 'string' ? BigInt(webhookId) : webhookId;

  const [updated] = await db
    .update(repoSettings)
    .set({
      webhookId: webhookIdBigInt,
      webhookSecret,
    })
    .where(eq(repoSettings.githubRepoId, repoIdBigInt))
    .returning();

  return updated;
}

/**
 * Toggle require_owner_approval flag for repo
 *
 * When enabled, bounty submissions require both:
 * 1. Primary funder approval
 * 2. Repo owner approval (via repo settings)
 */
export async function updateRepoOwnerApproval(
  githubRepoId: bigint | string,
  requireOwnerApproval: boolean
) {
  const repoIdBigInt = typeof githubRepoId === 'string' ? BigInt(githubRepoId) : githubRepoId;

  const [updated] = await db
    .update(repoSettings)
    .set({
      requireOwnerApproval,
    })
    .where(eq(repoSettings.githubRepoId, repoIdBigInt))
    .returning();

  return updated;
}

/**
 * Check if user is verified owner of repo
 *
 * Used for permission checks in settings pages and approval flows.
 */
export async function isUserRepoOwner(
  githubRepoId: bigint | string,
  userId: string
): Promise<boolean> {
  const settings = await getRepoSettingsByGithubRepoId(githubRepoId);
  return settings?.verifiedOwnerUserId === userId;
}

/**
 * Get user's repos with bounty statistics for profile display
 *
 * Computes stats on read (no cached totals in repo_settings).
 * Repo owner = user who verified ownership (created repo_settings).
 */
export async function getUserReposWithStats(userId: string | null) {
  if (!userId) {
    return [];
  }

  const results = await db
    .select({
      repo: repoSettings,
      openBountyCount: sql<number>`count(*) filter (where ${bounties.status} = 'open')::int`,
      totalBountyValue: sql<number>`coalesce(sum(${bounties.totalFunded}) filter (where ${bounties.status} = 'open'), 0)::bigint`,
    })
    .from(repoSettings)
    .leftJoin(bounties, eq(repoSettings.githubRepoId, bounties.repoSettingsId))
    .where(eq(repoSettings.verifiedOwnerUserId, userId))
    .groupBy(repoSettings.githubRepoId)
    .orderBy(desc(sql`count(*) filter (where ${bounties.status} = 'open')`));

  return results;
}

/**
 * Get top repos ranked by total open bounty value
 *
 * Shows repos with most active bounty funding (promise layer).
 * Includes both verified and permissionless repos.
 */
export async function getTopReposByBountyValue(limit = 6) {
  const results = await db
    .select({
      githubRepoId: bounties.githubRepoId,
      githubOwner: bounties.githubOwner,
      githubRepo: bounties.githubRepo,
      githubFullName: bounties.githubFullName,
      totalBountyValue: sql<number>`coalesce(sum(${bounties.totalFunded}) filter (where ${bounties.status} = 'open'), 0)::bigint`,
      openBountyCount: sql<number>`count(*) filter (where ${bounties.status} = 'open')::int`,
    })
    .from(bounties)
    .groupBy(
      bounties.githubRepoId,
      bounties.githubOwner,
      bounties.githubRepo,
      bounties.githubFullName
    )
    .having(sql`count(*) filter (where ${bounties.status} = 'open') > 0`)
    .orderBy(desc(sql`sum(${bounties.totalFunded}) filter (where ${bounties.status} = 'open')`))
    .limit(limit);

  return results;
}

/**
 * Check if repo requires owner approval for payouts
 *
 * Returns true if:
 * - Repo has settings (verified owner)
 * - AND require_owner_approval flag is enabled
 *
 * Returns false for permissionless repos (no settings).
 */
export async function doesRepoRequireOwnerApproval(
  githubRepoId: bigint | string
): Promise<boolean> {
  const settings = await getRepoSettingsByGithubRepoId(githubRepoId);
  return settings?.requireOwnerApproval ?? false;
}

/**
 * Get total count of repo settings (verified repos)
 *
 * Used for homepage stats display.
 */
export async function getRepoSettingsCount(): Promise<number> {
  const result = await db.select({ count: sql<number>`count(*)` }).from(repoSettings);

  return result[0]?.count ?? 0;
}
