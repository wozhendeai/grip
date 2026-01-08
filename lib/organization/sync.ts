import { auth } from '@/lib/auth/auth';
import { getAllOrgMembersByRole } from '@/lib/github';
import { db, invitation, member, organization, user } from '@/db';
import { and, eq } from 'drizzle-orm';

/**
 * GitHub Organization Membership Sync
 *
 * Syncs GitHub organization members to Grip organization:
 * 1. Fetches all GitHub org members
 * 2. Adds new members (if they have Grip accounts)
 * 3. Removes members no longer in GitHub org (only those from github_sync)
 * 4. Updates lastSyncedAt timestamp
 *
 * Design decisions:
 * - Only syncs users who already have Grip accounts (no auto-registration)
 * - Preserves manual invites (only removes members with sourceType='github_sync')
 * - Maps GitHub roles to Grip roles (admin → bountyManager, member → member)
 * - Returns detailed results for UI feedback
 *
 * GitHub role → Grip role mapping:
 * - GitHub 'admin' → Grip 'bountyManager'
 * - GitHub 'member' → Grip 'member'
 *
 * Note: 'owner' and 'billingAdmin' are never auto-assigned
 */

export interface SyncResult {
  added: number;
  removed: number;
  errors: string[];
}

/**
 * Sync GitHub organization members to Grip organization
 *
 * @param organizationId - Grip organization ID to sync
 * @param adminToken - User's GitHub OAuth token (must have read:org scope)
 * @returns Summary of sync operation (added, removed, errors)
 *
 * Throws:
 * - If organization not found
 * - If organization not configured for GitHub sync
 *
 * Example:
 *   const token = await getGitHubToken(userId);
 *   const result = await syncGitHubMembers(orgId, token);
 *   console.log(`Added ${result.added}, removed ${result.removed}`);
 */
export async function syncGitHubMembers(
  organizationId: string,
  adminToken: string
): Promise<SyncResult> {
  const errors: string[] = [];
  let added = 0;
  let removed = 0;

  // 1. Get organization details
  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);

  if (!org) {
    throw new Error('Organization not found');
  }

  if (!org.githubOrgLogin || !org.syncMembership) {
    throw new Error('Organization not configured for GitHub sync');
  }

  // 2. Fetch GitHub members with role information
  // Using batch role filtering - fetches admins and all members in parallel
  // This is 50x more efficient than checking each member's role individually
  // API calls: ~(N/100)*2 for N members (vs N individual role checks)
  // TODO: paginate completely, this'll not work for 100+ user orgs
  const { admins, allMembers: githubMembers } = await getAllOrgMembersByRole(
    adminToken,
    org.githubOrgLogin
  );

  // Create Set of admin IDs for O(1) role lookups
  const adminIds = new Set(admins.map((m) => m.id));

  // 3. Get current Grip members
  const currentMembers = await db
    .select({
      id: member.id,
      userId: member.userId,
      sourceType: member.sourceType,
      githubUserId: user.githubUserId,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, organizationId));

  // 4. Add new members (if they have Grip accounts)
  for (const ghMember of githubMembers) {
    try {
      // Find Grip user by GitHub ID
      const [gripUser] = await db
        .select()
        .from(user)
        .where(eq(user.githubUserId, BigInt(ghMember.id)))
        .limit(1);

      if (!gripUser) {
        // User not on Grip yet, skip
        // We don't auto-register users - they must sign up first
        continue;
      }

      // Check if already a member
      const existing = currentMembers.find((m) => m.userId === gripUser.id);
      if (existing) {
        // Already a member, skip
        continue;
      }

      // Determine role from adminIds Set (O(1) lookup, no API call!)
      // GitHub API supports ?role=admin filter, so we fetched admins separately
      const isAdmin = adminIds.has(ghMember.id);
      const githubRole = isAdmin ? 'admin' : 'member';

      // Map GitHub role to Grip role
      // GitHub 'admin' → Grip 'bountyManager'
      // GitHub 'member' → Grip 'member'
      // Why bountyManager? Admins should be able to manage bounties, but not wallet
      // Owner and billingAdmin are never auto-assigned (require manual promotion)
      const gripRole = isAdmin ? 'bountyManager' : 'member';

      // Add member via Better Auth API
      // This ensures all Better Auth hooks and validations run
      await auth.api.addMember({
        body: {
          userId: gripUser.id,
          organizationId,
          role: gripRole,
        },
      });

      // Update sourceType and githubOrgRole
      // These fields track that this member came from GitHub sync
      await db
        .update(member)
        .set({
          sourceType: 'github_sync',
          githubOrgRole: githubRole,
        })
        .where(and(eq(member.userId, gripUser.id), eq(member.organizationId, organizationId)));

      added++;
    } catch (error) {
      // Log error with full context for debugging
      console.error(`[SYNC] Failed to add ${ghMember.login} to org ${organizationId}:`, error);
      errors.push(
        `Failed to add ${ghMember.login}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // 5. Remove members no longer in GitHub org (only github_sync members)
  // IMPORTANT: We only remove members with sourceType='github_sync'
  // Manual invites are preserved even if user is not in GitHub org
  for (const memberRecord of currentMembers) {
    if (memberRecord.sourceType !== 'github_sync') {
      // Don't touch manual invites
      continue;
    }

    // Check if member still in GitHub org
    const stillInGitHub = githubMembers.some((gh) => BigInt(gh.id) === memberRecord.githubUserId);

    if (!stillInGitHub) {
      try {
        // Remove member directly from database
        // We're on the server side, so we can bypass the API layer
        await db.delete(member).where(eq(member.id, memberRecord.id));

        removed++;
      } catch (error) {
        console.error(
          `[SYNC] Failed to remove member ${memberRecord.userId} from org ${organizationId}:`,
          error
        );
        errors.push(
          `Failed to remove member ${memberRecord.userId}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  // 6. Update lastSyncedAt timestamp
  await db
    .update(organization)
    .set({ lastSyncedAt: new Date() })
    .where(eq(organization.id, organizationId));

  return { added, removed, errors };
}
