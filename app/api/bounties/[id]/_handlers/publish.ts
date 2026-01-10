import { getBountyWithRepoSettings } from '@/db/queries/bounties';
import { auth } from '@/lib/auth/auth';
import type { requireAuth } from '@/lib/auth/auth-server';
import {
  getGitHubToken,
  addLabelToIssue,
  commentOnIssue,
  generateBountyComment,
} from '@/lib/github';
import { checkOrgMatch } from '@/app/api/_lib';
import { headers } from 'next/headers';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://usegrip.xyz';

/**
 * Handle bounty publishing to GitHub
 *
 * Adds bounty label and comment to the GitHub issue.
 */
export async function handlePublish(
  session: Awaited<ReturnType<typeof requireAuth>>,
  bountyId: string
) {
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
        { error: 'Only organization members can publish org bounties' },
        { status: 403 }
      );
    }
  } else if (bounty.primaryFunderId !== session.user.id) {
    return Response.json(
      { error: 'Only the primary funder can publish bounties' },
      { status: 403 }
    );
  }

  // Get user's GitHub token for API calls
  const githubToken = await getGitHubToken(session.user.id);
  if (!githubToken) {
    return Response.json(
      { error: 'GitHub token not found. Please reconnect your GitHub account.' },
      { status: 401 }
    );
  }

  const owner = bounty.githubOwner ?? '';
  const repo = bounty.githubRepo ?? '';
  const issueNumber = bounty.githubIssueNumber;

  // Generate bounty comment
  const bountyUrl = `${APP_URL}/${owner}/${repo}/bounties/${bounty.id}`;
  const commentBody = generateBountyComment({
    amount: (Number(bounty.totalFunded) / 1_000_000).toFixed(2),
    tokenSymbol: 'USDC',
    claimDeadlineDays: 30,
    bountyUrl,
  });

  // Add label and comment to GitHub issue
  const [labelResult, commentResult] = await Promise.allSettled([
    addLabelToIssue(githubToken, owner, repo, issueNumber),
    commentOnIssue(githubToken, owner, repo, issueNumber, commentBody),
  ]);

  const labelAdded = labelResult.status === 'fulfilled';
  const commentPosted = commentResult.status === 'fulfilled';

  if (!labelAdded && !commentPosted) {
    return Response.json(
      { error: 'Failed to publish to GitHub. Check repository permissions.' },
      { status: 500 }
    );
  }

  return Response.json({
    success: true,
    message: 'Bounty published to GitHub',
    labelAdded,
    commentPosted,
  });
}
