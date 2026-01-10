import {
  type BountyStatus,
  type SortOption,
  createBounty,
  getAllBounties,
} from '@/db/queries/bounties';
import { getRepoSettingsByName } from '@/db/queries/repo-settings';
import { requireAuth } from '@/lib/auth/auth-server';
import {
  addLabelToIssue,
  commentOnIssue,
  fetchGitHubRepo,
  generateBountyComment,
  getGitHubToken,
  getIssue,
} from '@/lib/github';
import { handleRouteError, validateBody } from '@/app/api/_lib';
import { createBountySchema } from '@/app/api/_lib/schemas';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status') as BountyStatus | null;
    const sort = searchParams.get('sort') as SortOption | null;
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const results = await getAllBounties({
      status: status ?? 'open',
      sort: sort ?? 'newest',
      limit: limit ? Number.parseInt(limit, 10) : 50,
      offset: offset ? Number.parseInt(offset, 10) : 0,
    });

    // Transform to API response format
    const bounties = results.map(({ bounty, repoSettings }) => ({
      id: bounty.id,
      title: bounty.title,
      body: bounty.body,
      amount: bounty.totalFunded,
      tokenAddress: bounty.tokenAddress,
      status: bounty.status,
      labels: bounty.labels,
      githubIssueNumber: bounty.githubIssueNumber,
      githubIssueUrl: `https://github.com/${bounty.githubFullName}/issues/${bounty.githubIssueNumber}`,
      createdAt: bounty.createdAt,
      project: {
        githubOwner: bounty.githubOwner,
        githubRepo: bounty.githubRepo,
        githubFullName: bounty.githubFullName,
      },
    }));

    return Response.json({ bounties });
  } catch (error) {
    return handleRouteError(error, 'fetching bounties');
  }
}

/**
 * POST /api/bounties
 *
 * PERMISSIONLESS bounty creation.
 * Works for ANY public GitHub repository, whether or not it has repo settings.
 *
 * Body:
 * - owner: string (GitHub repo owner)
 * - repo: string (GitHub repo name)
 * - githubIssueNumber: number (required)
 * - amount: number (required, in USD smallest unit)
 * - tokenAddress: string (required, token address for the bounty)
 * - publish?: boolean (if true, immediately publish the bounty)
 *
 * Returns:
 * - bounty: The created bounty
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await validateBody(request, createBountySchema);

    const { owner, repo, githubIssueNumber, amount, tokenAddress, publish } = body;

    // Fetch GitHub repo info
    const githubRepo = await fetchGitHubRepo(owner, repo);
    if (!githubRepo) {
      return Response.json({ error: 'Repository not found on GitHub' }, { status: 404 });
    }

    if (githubRepo.private) {
      return Response.json(
        { error: 'Cannot create bounties on private repositories' },
        { status: 400 }
      );
    }

    // Get repo settings if they exist (optional - permissionless model)
    const repoSettings = await getRepoSettingsByName(owner, repo);

    // Get GitHub token
    const token = await getGitHubToken(session.user.id);
    if (!token) {
      return Response.json(
        { error: 'GitHub account not connected. Please sign in with GitHub.' },
        { status: 400 }
      );
    }

    // Fetch issue details from GitHub to verify it exists and get metadata
    const githubIssue = await getIssue(token, owner, repo, githubIssueNumber);

    if (!githubIssue) {
      return Response.json(
        { error: `Issue #${githubIssueNumber} not found in ${owner}/${repo}` },
        { status: 404 }
      );
    }

    if (githubIssue.state !== 'open') {
      return Response.json(
        {
          error: `Issue #${githubIssueNumber} is closed. Can only create bounties for open issues.`,
        },
        { status: 400 }
      );
    }

    // Create the bounty
    const bounty = await createBounty({
      repoSettingsId: repoSettings?.githubRepoId ? Number(repoSettings.githubRepoId) : null, // Nullable for permissionless

      // GitHub repo info
      githubRepoId: BigInt(githubRepo.id),
      githubOwner: githubRepo.owner.login,
      githubRepo: githubRepo.name,
      githubFullName: githubRepo.full_name,

      primaryFunderId: session.user.id,
      githubIssueNumber,
      githubIssueId: BigInt(githubIssue.id),
      githubIssueAuthorId: githubIssue.user?.id ? BigInt(githubIssue.user.id) : undefined,
      title: githubIssue.title,
      body: githubIssue.body ?? undefined,
      labels: githubIssue.labels as Array<{
        id: number;
        name: string;
        color: string;
        description?: string;
      }>,
      amount: BigInt(amount),
      tokenAddress,
    });

    // If publish is true, immediately publish the bounty
    if (publish) {
      try {
        // Add bounty label to GitHub issue
        await addLabelToIssue(token, owner, repo, githubIssueNumber);

        // Post comment on the issue
        const bountyUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://usegrip.xyz'}/${owner}/${repo}/bounties/${bounty.id}`;
        const commentBody = generateBountyComment({
          amount,
          tokenSymbol: 'USDC',
          claimDeadlineDays: 14,
          bountyUrl,
        });
        await commentOnIssue(token, owner, repo, githubIssueNumber, commentBody);

        return Response.json(
          {
            bounty,
            published: true,
            message: 'Bounty created and published successfully',
          },
          { status: 201 }
        );
      } catch (publishError) {
        // Bounty was created but publishing failed
        console.error('Failed to publish bounty:', publishError);
        return Response.json(
          {
            bounty,
            published: false,
            message: 'Bounty created. Publishing failed - you can try publishing later.',
            publishError: publishError instanceof Error ? publishError.message : 'Unknown error',
          },
          { status: 201 }
        );
      }
    }

    return Response.json(
      {
        bounty,
        published: false,
        message: 'Bounty created. Publish it to make it visible to contributors.',
      },
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError(error, 'creating bounty');
  }
}
