import { requireAuth } from '@/lib/auth-server';
import {
  type BountyStatus,
  type SortOption,
  createBounty,
  getAllBounties,
  updateBountyStatus,
} from '@/lib/db/queries/bounties';
import {
  doesRepoRequireOwnerApproval,
  getRepoSettingsByName,
} from '@/lib/db/queries/repo-settings';
import {
  addLabelToIssue,
  commentOnIssue,
  generateBountyComment,
  getGitHubToken,
  getIssue,
} from '@/lib/github/issues';
import { fetchGitHubRepo } from '@/lib/github/repo';
import { TEMPO_TOKENS } from '@/lib/tempo/constants';
import { type NextRequest, NextResponse } from 'next/server';

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

    return NextResponse.json({ bounties });
  } catch (error) {
    console.error('Error fetching bounties:', error);
    return NextResponse.json({ error: 'Failed to fetch bounties' }, { status: 500 });
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
 * - tokenAddress?: string (defaults to USDC)
 * - publish?: boolean (if true, immediately publish the bounty)
 *
 * Returns:
 * - bounty: The created bounty
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Parse request body
    const body = await request.json();
    const { owner, repo, githubIssueNumber, amount, tokenAddress, publish } = body;

    // Validate required fields
    if (!owner || !repo) {
      return NextResponse.json({ error: 'owner and repo are required' }, { status: 400 });
    }

    if (typeof githubIssueNumber !== 'number' || githubIssueNumber <= 0) {
      return NextResponse.json({ error: 'Valid githubIssueNumber is required' }, { status: 400 });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 });
    }

    // Fetch GitHub repo info
    const githubRepo = await fetchGitHubRepo(owner, repo);
    if (!githubRepo) {
      return NextResponse.json({ error: 'Repository not found on GitHub' }, { status: 404 });
    }

    if (githubRepo.private) {
      return NextResponse.json(
        { error: 'Cannot create bounties on private repositories' },
        { status: 400 }
      );
    }

    // Get repo settings if they exist (optional - permissionless model)
    const repoSettings = await getRepoSettingsByName(owner, repo);

    // Get GitHub token
    const token = await getGitHubToken(session.user.id);
    if (!token) {
      return NextResponse.json(
        { error: 'GitHub account not connected. Please sign in with GitHub.' },
        { status: 400 }
      );
    }

    // Fetch issue details from GitHub to verify it exists and get metadata
    const githubIssue = await getIssue(token, owner, repo, githubIssueNumber);

    if (!githubIssue) {
      return NextResponse.json(
        { error: `Issue #${githubIssueNumber} not found in ${owner}/${repo}` },
        { status: 404 }
      );
    }

    if (githubIssue.state !== 'open') {
      return NextResponse.json(
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
      tokenAddress: tokenAddress ?? TEMPO_TOKENS.USDC,
    });

    // If publish is true, immediately publish the bounty
    if (publish) {
      try {
        // Add bounty label to GitHub issue
        await addLabelToIssue(token, owner, repo, githubIssueNumber);

        // Post comment on the issue
        const bountyUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://bountylane.xyz'}/${owner}/${repo}/bounties/${bounty.id}`;
        const commentBody = generateBountyComment({
          amount,
          tokenSymbol: 'USDC',
          claimDeadlineDays: 14,
          bountyUrl,
        });
        await commentOnIssue(token, owner, repo, githubIssueNumber, commentBody);

        // Bounty is already 'open' status from creation
        return NextResponse.json(
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
        return NextResponse.json(
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

    return NextResponse.json(
      {
        bounty,
        published: false,
        message: 'Bounty created. Publish it to make it visible to contributors.',
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error creating bounty:', error);
    return NextResponse.json({ error: 'Failed to create bounty' }, { status: 500 });
  }
}
