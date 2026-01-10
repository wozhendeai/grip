import { getBountyWithRepoSettings } from '@/db/queries/bounties';
import { auth } from '@/lib/auth/auth';
import {
  getActiveSubmissionsForBounty,
  getSubmissionById,
  rejectSubmission,
} from '@/db/queries/submissions';
import type { requireAuth } from '@/lib/auth/auth-server';
import { checkOrgMatch } from '@/app/api/_lib';
import { headers } from 'next/headers';

type RejectParams = {
  submissionId?: string;
  note?: string;
};

/**
 * Handle bounty rejection
 *
 * Rejects submission and reopens bounty for new submissions.
 */
export async function handleReject(
  session: Awaited<ReturnType<typeof requireAuth>>,
  bountyId: string,
  params: RejectParams
) {
  const { note } = params;

  if (!note?.trim()) {
    return Response.json({ error: 'Rejection note is required' }, { status: 400 });
  }

  const result = await getBountyWithRepoSettings(bountyId);
  if (!result) {
    return Response.json({ error: 'Bounty not found' }, { status: 404 });
  }

  const { bounty } = result;
  const isOrgBounty = !!bounty.organizationId;
  const activeOrgId = session.session?.activeOrganizationId;

  // Validate org context
  const orgMismatch = checkOrgMatch(bounty.organizationId, activeOrgId);
  if (orgMismatch) {
    return Response.json({ error: orgMismatch }, { status: 403 });
  }

  // Permission check
  if (isOrgBounty) {
    const headersList = await headers();
    const hasPermission = await auth.api.hasPermission({
      headers: headersList,
      body: { permissions: { member: ['read'] }, organizationId: bounty.organizationId! },
    });
    if (!hasPermission?.success) {
      return Response.json(
        { error: 'Only organization members can reject org bounty submissions' },
        { status: 403 }
      );
    }
  } else if (bounty.primaryFunderId !== session.user.id) {
    return Response.json(
      { error: 'Only the primary funder can reject submissions' },
      { status: 403 }
    );
  }

  // Resolve which submission to reject
  const submissionToReject = await resolveSubmission(bountyId, params.submissionId);
  if ('error' in submissionToReject) {
    return Response.json(submissionToReject, { status: 400 });
  }

  // Reject the submission
  await rejectSubmission(submissionToReject.id, session.user.id, note);

  return Response.json({
    success: true,
    message: 'Submission rejected',
    reopened: true,
  });
}

async function resolveSubmission(bountyId: string, explicitId?: string) {
  if (explicitId) {
    const submission = await getSubmissionById(explicitId);
    if (!submission || submission.bountyId !== bountyId) {
      return { error: 'Invalid submission ID' };
    }
    return submission;
  }

  const activeSubmissions = await getActiveSubmissionsForBounty(bountyId);
  if (activeSubmissions.length === 0) {
    return { error: 'No active submissions to reject' };
  }
  if (activeSubmissions.length > 1) {
    return {
      error: 'Multiple active submissions. Specify submissionId in request body.',
    };
  }
  return activeSubmissions[0].submission;
}
