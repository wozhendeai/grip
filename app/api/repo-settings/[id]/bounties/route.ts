import { requireAuth } from '@/lib/auth-server';
import { createBounty, getBountyByGitHubIssueId } from '@/lib/db/queries/bounties';
import { getRepoSettingsByGithubRepoId, isUserRepoOwner } from '@/lib/db/queries/repo-settings';
import {
  addLabelToIssue,
  commentOnIssue,
  generateBountyComment,
  getGitHubToken,
  getIssue,
} from '@/lib/github/issues';
import { TEMPO_TOKENS } from '@/lib/tempo/constants';
import { type NextRequest, NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/repo-settings/[id]/bounties
 *
 * Create a new bounty for a repo.
 * Can be called by anyone (permissionless), but repo owner gets approval control.
 *
 * Body:
 * - githubIssueNumber: number (required)
 * - amount: number (required, in smallest token units)
 * - tokenAddress?: string (defaults to USDC)
 * - publish?: boolean (if true, immediately publish the bounty)
 *
 * Returns:
 * - bounty: The created bounty
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;
    const githubRepoId = Number.parseInt(id);

    if (Number.isNaN(githubRepoId)) {
      return NextResponse.json({ error: 'Invalid repo ID' }, { status: 400 });
    }

    // Parse request body
    const body = await request.json();
    const { githubIssueNumber, amount, tokenAddress, publish } = body;

    // Validate required fields
    if (typeof githubIssueNumber !== 'number' || githubIssueNumber <= 0) {
      return NextResponse.json({ error: 'Valid githubIssueNumber is required' }, { status: 400 });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 });
    }

    // Get repo settings (optional - permissionless model)
    const repoSettings = await getRepoSettingsByGithubRepoId(BigInt(githubRepoId));

    // Get GitHub repo info - we need this even without repo settings
    // For permissionless bounties, we'll fetch from GitHub API

    // Get GitHub token
    const token = await getGitHubToken(session.user.id);
    if (!token) {
      return NextResponse.json(
        { error: 'GitHub account not connected. Please sign in with GitHub.' },
        { status: 400 }
      );
    }

    // Fetch GitHub repo to get owner/name
    // We need this to construct the full repo info
    const githubRepo = await fetch(`https://api.github.com/repositories/${githubRepoId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());

    if (!githubRepo || !githubRepo.owner || !githubRepo.name) {
      return NextResponse.json({ error: 'Could not fetch GitHub repo info' }, { status: 500 });
    }

    const githubOwner = githubRepo.owner.login;
    const githubRepoName = githubRepo.name;
    const githubFullName = githubRepo.full_name;

    // Fetch issue details from GitHub to verify it exists and get metadata
    const githubIssue = await getIssue(token, githubOwner, githubRepoName, githubIssueNumber);

    if (!githubIssue) {
      return NextResponse.json(
        { error: `Issue #${githubIssueNumber} not found in ${githubFullName}` },
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

    // Check if bounty already exists for this issue
    const existingBounty = await getBountyByGitHubIssueId(BigInt(githubIssue.id));
    if (existingBounty) {
      return NextResponse.json(
        {
          error: 'A bounty already exists for this issue',
          bounty: existingBounty,
        },
        { status: 409 }
      );
    }

    // Create the bounty
    const bounty = await createBounty({
      repoSettingsId: repoSettings?.githubRepoId ? Number(repoSettings.githubRepoId) : null, // nullable

      // GitHub repo info
      githubRepoId: BigInt(githubRepoId),
      githubOwner,
      githubRepo: githubRepoName,
      githubFullName,

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
      primaryFunderId: session.user.id,
    });

    // If publish is true, immediately add GitHub label and comment
    if (publish) {
      try {
        // Add bounty label to GitHub issue
        await addLabelToIssue(token, githubOwner, githubRepoName, githubIssueNumber);

        // Post comment on the issue
        const bountyUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://bountylane.xyz'}/${githubOwner}/${githubRepoName}/bounties/${bounty.id}`;
        const commentBody = generateBountyComment({
          amount: amount.toString(),
          tokenSymbol: 'USDC',
          claimDeadlineDays: 14,
          bountyUrl,
        });
        await commentOnIssue(token, githubOwner, githubRepoName, githubIssueNumber, commentBody);

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
            message: 'Bounty created but GitHub publishing failed. You can try publishing later.',
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
        message: 'Bounty created. Publish it to add a GitHub label and comment.',
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
