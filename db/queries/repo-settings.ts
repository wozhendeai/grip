import { bounties, db, repoSettings } from '@/db';
import { and, desc, eq, sql } from 'drizzle-orm';

export type CreateRepoSettingsInput = {
  verifiedOwnerUserId: string;
  githubRepoId: bigint | string;
  githubOwner: string;
  githubRepo: string;
  installationId?: bigint | string;
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

  const installationId = input.installationId
    ? typeof input.installationId === 'string'
      ? BigInt(input.installationId)
      : input.installationId
    : null;

  const [settings] = await db
    .insert(repoSettings)
    .values({
      githubRepoId,
      githubOwner: input.githubOwner,
      githubRepo: input.githubRepo,
      verifiedOwnerUserId: input.verifiedOwnerUserId,
      verifiedAt: new Date().toISOString(),
      installationId,
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

export type RepoSettingsUpdate = Partial<{
  autoPayEnabled: boolean;
  requireOwnerApproval: boolean;
  defaultExpirationDays: number | null;
  contributorEligibility: 'anyone' | 'collaborators';
  showAmountsPublicly: boolean;
  emailOnSubmission: boolean;
  emailOnMerge: boolean;
  emailOnPaymentFailure: boolean;
  onboardingCompleted: boolean;
}>;

/**
 * Update repo settings (batch update for all configurable fields)
 *
 * Used by settings page to update multiple fields at once.
 */
export async function updateRepoSettings(
  githubRepoId: bigint | string,
  updates: RepoSettingsUpdate
) {
  const repoIdBigInt = typeof githubRepoId === 'string' ? BigInt(githubRepoId) : githubRepoId;

  const [updated] = await db
    .update(repoSettings)
    .set(updates)
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
 * Get total count of repo settings (verified repos)
 *
 * Used for homepage stats display.
 */
export async function getRepoSettingsCount(): Promise<number> {
  const result = await db.select({ count: sql<number>`count(*)` }).from(repoSettings);

  return result[0]?.count ?? 0;
}

/**
 * Unclaim all repos by installation ID
 *
 * Called when GitHub App is uninstalled. Nulls out verification fields
 * but keeps the repo_settings record for historical bounty associations.
 */
export async function unclaimReposByInstallationId(installationId: bigint | string) {
  const installationIdBigInt =
    typeof installationId === 'string' ? BigInt(installationId) : installationId;

  const updated = await db
    .update(repoSettings)
    .set({
      verifiedOwnerUserId: null,
      installationId: null,
      verifiedAt: null,
    })
    .where(eq(repoSettings.installationId, installationIdBigInt))
    .returning();

  return updated;
}

/**
 * Unclaim a single repo by GitHub repo ID
 *
 * Called when a repo is removed from a GitHub App installation.
 * Nulls out verification fields but keeps the record.
 */
export async function unclaimRepoByGithubRepoId(githubRepoId: bigint | string) {
  const repoIdBigInt = typeof githubRepoId === 'string' ? BigInt(githubRepoId) : githubRepoId;

  const [updated] = await db
    .update(repoSettings)
    .set({
      verifiedOwnerUserId: null,
      installationId: null,
      verifiedAt: null,
    })
    .where(eq(repoSettings.githubRepoId, repoIdBigInt))
    .returning();

  return updated ?? null;
}

/**
 * Update repo settings with installation ID and verified owner
 *
 * Used when claiming a repo via GitHub App installation.
 */
export async function updateRepoInstallation(
  githubRepoId: bigint | string,
  installationId: bigint | string,
  verifiedOwnerUserId: string
) {
  const repoIdBigInt = typeof githubRepoId === 'string' ? BigInt(githubRepoId) : githubRepoId;
  const installationIdBigInt =
    typeof installationId === 'string' ? BigInt(installationId) : installationId;

  const [updated] = await db
    .update(repoSettings)
    .set({
      installationId: installationIdBigInt,
      verifiedOwnerUserId,
      verifiedAt: new Date().toISOString(),
    })
    .where(eq(repoSettings.githubRepoId, repoIdBigInt))
    .returning();

  return updated ?? null;
}
