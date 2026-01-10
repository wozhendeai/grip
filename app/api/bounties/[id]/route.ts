import { getBountyWithAuthor, getBountyWithFunders } from '@/db/queries/bounties';
import { getSubmissionsByBounty } from '@/db/queries/submissions';
import { requireAuth } from '@/lib/auth/auth-server';
import { handleRouteError, validateBody } from '@/app/api/_lib';
import { bountyPatchActionSchema } from '@/app/api/_lib/schemas';
import { handleApprove, handleReject, handlePublish } from './_handlers';
import type { NextRequest } from 'next/server';

/**
 * GET /api/bounties/[id]
 *
 * Fetch a single bounty by ID with full details including author, funders, and submissions.
 * Public endpoint - no authentication required.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<'/api/bounties/[id]'>) {
  try {
    const { id } = await ctx.params;
    const result = await getBountyWithAuthor(id);
    if (!result) {
      return Response.json({ error: 'Bounty not found' }, { status: 404 });
    }

    const { bounty, author } = result;

    // Fetch submissions and funders in parallel
    const [submissionsData, bountyWithFunders] = await Promise.all([
      getSubmissionsByBounty(id),
      getBountyWithFunders(id),
    ]);

    // Transform to API response format
    const response = {
      id: bounty.id,
      title: bounty.title,
      body: bounty.body,
      amount: bounty.totalFunded,
      tokenAddress: bounty.tokenAddress,
      status: bounty.status,
      labels: bounty.labels,
      githubIssueNumber: bounty.githubIssueNumber,
      githubIssueUrl: `https://github.com/${bounty.githubFullName}/issues/${bounty.githubIssueNumber}`,
      approvedAt: bounty.approvedAt,
      ownerApprovedAt: bounty.ownerApprovedAt,
      paidAt: bounty.paidAt,
      createdAt: bounty.createdAt,
      chainId: bounty.chainId,
      project: {
        githubOwner: bounty.githubOwner,
        githubRepo: bounty.githubRepo,
        githubFullName: bounty.githubFullName,
      },
      author: author
        ? {
            id: author.id,
            name: author.name,
            image: author.image,
          }
        : null,
      funders: bountyWithFunders?.funders ?? [],
      submissions: submissionsData.map(({ submission, submitter }) => ({
        id: submission.id,
        status: submission.status,
        githubPrNumber: submission.githubPrNumber,
        githubPrUrl: submission.githubPrUrl,
        githubPrTitle: submission.githubPrTitle,
        submittedAt: submission.submittedAt,
        funderApprovedAt: submission.funderApprovedAt,
        ownerApprovedAt: submission.ownerApprovedAt,
        rejectedAt: submission.rejectedAt,
        rejectionNote: submission.rejectionNote,
        prMergedAt: submission.prMergedAt,
        submitter: {
          id: submitter.id,
          name: submitter.name,
          image: submitter.image,
          hasWallet: submitter.hasWallet,
        },
      })),
    };

    return Response.json(response);
  } catch (error) {
    return handleRouteError(error, 'fetching bounty');
  }
}

/**
 * PATCH /api/bounties/[id]
 *
 * Perform actions on a bounty: approve, reject, or publish.
 * Uses discriminated union for type-safe action handling.
 *
 * Actions:
 * - approve: Approve submission and initiate payout
 * - reject: Reject submission with note
 * - publish: Add GitHub label and comment to issue
 */
export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/bounties/[id]'>) {
  try {
    const session = await requireAuth();
    const { id } = await ctx.params;
    const body = await validateBody(request, bountyPatchActionSchema);

    switch (body.action) {
      case 'approve':
        return handleApprove(session, id, {
          submissionId: body.submissionId,
          useAccessKey: body.useAccessKey,
        });

      case 'reject':
        return handleReject(session, id, {
          submissionId: body.submissionId,
          note: body.note,
        });

      case 'publish':
        return handlePublish(session, id);

      default: {
        const _exhaustiveCheck: never = body;
        return Response.json({ error: 'Invalid action' }, { status: 400 });
      }
    }
  } catch (error) {
    return handleRouteError(error, 'bounty action');
  }
}
