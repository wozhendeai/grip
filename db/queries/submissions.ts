import { bounties, db, repoSettings, submissions, user } from '@/db';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';

/**
 * Cleanup note (2025-12-14):
 * Removed 6 unused functions that were never called:
 * - markSubmissionMerged() - webhook doesn't use it (uses updateSubmissionStatus directly)
 * - markSubmissionPaid() - confirmation flow doesn't use it
 * - expireSubmission() - cancellation doesn't use it
 * - getPendingOwnerApprovals() - no dashboard implemented
 * - getPendingFunderApprovals() - no dashboard implemented
 * - approveSubmission() - legacy wrapper replaced by approveBountySubmissionAsFunder
 */

export type SubmissionStatus =
  | 'pending' // PR submitted, awaiting funder review
  | 'approved' // Funder approved (and owner if required), awaiting merge
  | 'rejected' // Rejected by funder or owner
  | 'merged' // PR merged on GitHub (webhook event)
  | 'paid' // Payment transaction confirmed on-chain
  | 'expired'; // Bounty cancelled before approval

export type CreateSubmissionInput = {
  bountyId: string;
  userId: string;
  githubUserId?: bigint | string;
  githubPrId?: bigint | string;
  githubPrNumber?: number;
  githubPrUrl?: string;
  githubPrTitle?: string;
};

/**
 * Create submission (work submission / PR for bounty)
 *
 * Multiple users can submit on same bounty (race condition model).
 * First merged PR wins.
 */
export async function createSubmission(input: CreateSubmissionInput) {
  const githubUserId = input.githubUserId
    ? typeof input.githubUserId === 'string'
      ? BigInt(input.githubUserId)
      : input.githubUserId
    : undefined;
  const githubPrId = input.githubPrId
    ? typeof input.githubPrId === 'string'
      ? BigInt(input.githubPrId)
      : input.githubPrId
    : undefined;

  const [submission] = await db
    .insert(submissions)
    .values({
      bountyId: input.bountyId,
      userId: input.userId,
      githubUserId,
      githubPrId,
      githubPrNumber: input.githubPrNumber,
      githubPrUrl: input.githubPrUrl,
      githubPrTitle: input.githubPrTitle,
      status: 'pending',
      submittedAt: new Date().toISOString(),
    })
    .returning();

  return submission;
}

export async function getSubmissionById(id: string) {
  const [submission] = await db.select().from(submissions).where(eq(submissions.id, id)).limit(1);

  return submission ?? null;
}

export async function getSubmissionWithDetails(id: string) {
  const [result] = await db
    .select({
      submission: submissions,
      bounty: bounties,
      repoSettings: repoSettings,
      submitter: {
        id: user.id,
        name: user.name,
        image: user.image,
        githubUserId: user.githubUserId,
      },
    })
    .from(submissions)
    .innerJoin(bounties, eq(submissions.bountyId, bounties.id))
    .leftJoin(repoSettings, eq(bounties.repoSettingsId, repoSettings.githubRepoId))
    .innerJoin(user, eq(submissions.userId, user.id))
    .where(eq(submissions.id, id))
    .limit(1);

  return result ?? null;
}

export async function getSubmissionsByUser(userId: string) {
  return db
    .select({
      submission: submissions,
      bounty: bounties,
      repoSettings: repoSettings,
    })
    .from(submissions)
    .innerJoin(bounties, eq(submissions.bountyId, bounties.id))
    .leftJoin(repoSettings, eq(bounties.repoSettingsId, repoSettings.githubRepoId))
    .where(eq(submissions.userId, userId))
    .orderBy(desc(submissions.createdAt));
}

export async function getSubmissionsByBounty(bountyId: string) {
  return db
    .select({
      submission: submissions,
      submitter: {
        id: user.id,
        name: user.name,
        image: user.image,
      },
    })
    .from(submissions)
    .innerJoin(user, eq(submissions.userId, user.id))
    .where(eq(submissions.bountyId, bountyId))
    .orderBy(desc(submissions.createdAt));
}

export async function getUserSubmissionForBounty(bountyId: string, userId: string) {
  const [submission] = await db
    .select()
    .from(submissions)
    .where(and(eq(submissions.bountyId, bountyId), eq(submissions.userId, userId)))
    .orderBy(desc(submissions.createdAt))
    .limit(1);

  return submission ?? null;
}

export async function updateSubmissionStatus(
  id: string,
  status: SubmissionStatus,
  additionalFields?: Partial<{
    githubPrNumber: number;
    githubPrUrl: string;
    githubPrTitle: string;
    funderApprovedAt: string;
    funderApprovedBy: string;
    ownerApprovedAt: string;
    ownerApprovedBy: string;
    rejectedAt: string;
    rejectedBy: string;
    rejectionNote: string;
    prMergedAt: string;
    prClosedAt: string;
  }>
) {
  const [updated] = await db
    .update(submissions)
    .set({
      status,
      ...additionalFields,
    })
    .where(eq(submissions.id, id))
    .returning();

  return updated;
}

/**
 * Approve submission as primary funder
 *
 * Sets funder_approved_at and funder_approved_by.
 * If repo requires owner approval, status stays 'pending'.
 * Otherwise, status becomes 'approved'.
 */
export async function approveBountySubmissionAsFunder(
  id: string,
  approvedBy: string,
  requireOwnerApproval: boolean
) {
  return updateSubmissionStatus(id, requireOwnerApproval ? 'pending' : 'approved', {
    funderApprovedAt: new Date().toISOString(),
    funderApprovedBy: approvedBy,
  });
}

/**
 * Approve submission as repo owner
 *
 * Sets owner_approved_at and owner_approved_by.
 * Status becomes 'approved' if funder also approved.
 */
export async function approveBountySubmissionAsOwner(id: string, approvedBy: string) {
  const submission = await getSubmissionById(id);
  if (!submission) return null;

  // Only set status to approved if funder already approved
  const newStatus = submission.funderApprovedAt ? 'approved' : 'pending';

  return updateSubmissionStatus(id, newStatus as SubmissionStatus, {
    ownerApprovedAt: new Date().toISOString(),
    ownerApprovedBy: approvedBy,
  });
}

/**
 * Reject submission
 *
 * Can be rejected by either funder or repo owner.
 */
export async function rejectSubmission(id: string, rejectedBy: string, note?: string) {
  return updateSubmissionStatus(id, 'rejected', {
    rejectedAt: new Date().toISOString(),
    rejectedBy: rejectedBy,
    rejectionNote: note,
  });
}

/**
 * Get all submissions for a bounty (race condition model)
 *
 * Multiple users can submit work on same bounty.
 * Returns all submissions ordered by creation time.
 */
export async function getSubmissionsForBounty(bountyId: string) {
  return getSubmissionsByBounty(bountyId);
}

/**
 * Find or create submission for GitHub user who submitted PR
 *
 * Used when PR is opened by someone who hasn't explicitly submitted.
 * Creates an implicit submission to track their work.
 *
 * Returns null if GitHub user hasn't signed up with BountyLane.
 */
export async function findOrCreateSubmissionForGitHubUser(
  bountyId: string,
  githubUserId: bigint | string,
  githubPrId: bigint | string,
  githubPrNumber: number,
  githubPrUrl: string,
  githubPrTitle: string
): Promise<typeof submissions.$inferSelect | null> {
  const userIdBigInt = typeof githubUserId === 'string' ? BigInt(githubUserId) : githubUserId;
  const prIdBigInt = typeof githubPrId === 'string' ? BigInt(githubPrId) : githubPrId;

  // First try to find BountyLane user by GitHub user ID
  const [userRecord] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.githubUserId, userIdBigInt))
    .limit(1);

  if (!userRecord) {
    // User hasn't signed up with BountyLane yet
    return null;
  }

  // Check if submission already exists for this PR
  const [existingSubmission] = await db
    .select()
    .from(submissions)
    .where(eq(submissions.githubPrId, prIdBigInt))
    .limit(1);

  if (existingSubmission) {
    return existingSubmission;
  }

  // Create implicit submission
  return createSubmission({
    bountyId,
    userId: userRecord.id,
    githubUserId: userIdBigInt,
    githubPrId: prIdBigInt,
    githubPrNumber,
    githubPrUrl,
    githubPrTitle,
  });
}

/**
 * Get submission by GitHub PR ID (canonical reference)
 *
 * Used by webhooks to find submission when PR events occur.
 */
export async function getSubmissionByGitHubPrId(githubPrId: bigint | string) {
  const prIdBigInt = typeof githubPrId === 'string' ? BigInt(githubPrId) : githubPrId;

  const [submission] = await db
    .select()
    .from(submissions)
    .where(eq(submissions.githubPrId, prIdBigInt))
    .limit(1);

  return submission ?? null;
}

/**
 * Get active submissions for bounty (pending/approved/merged - not rejected/expired/paid)
 *
 * Used in approval/rejection flows to check for competing submissions.
 * "Active" means submission is still in play for winning the bounty.
 */
export async function getActiveSubmissionsForBounty(bountyId: string) {
  return db
    .select({
      submission: submissions,
      submitter: {
        id: user.id,
        name: user.name,
        image: user.image,
      },
    })
    .from(submissions)
    .innerJoin(user, eq(submissions.userId, user.id))
    .where(
      and(
        eq(submissions.bountyId, bountyId),
        inArray(submissions.status, ['pending', 'approved', 'merged'])
      )
    )
    .orderBy(desc(submissions.createdAt));
}
