import { bounties, db, repoSettings } from '@/db';
import { updateBountyStatus } from '@/db/queries/bounties';
import {
  unclaimRepoByGithubRepoId,
  unclaimReposByInstallationId,
} from '@/db/queries/repo-settings';
import {
  findOrCreateSubmissionForGitHubUser,
  getActiveSubmissionsForBounty,
  updateSubmissionStatus,
} from '@/db/queries/submissions';
import { findUserByGitHubUsername } from '@/db/queries/users';
import {
  type InstallationEvent,
  type InstallationRepositoriesEvent,
  type IssueEvent,
  type PingEvent,
  type PullRequestEvent,
  extractLinkedIssues,
  verifyWebhookSignature,
} from '@/lib/github/webhooks';
import { notifyPrSubmitted } from '@/lib/notifications';
import { and, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

// App-level events that use GITHUB_APP_WEBHOOK_SECRET instead of per-repo secret
const APP_LEVEL_EVENTS = ['installation', 'installation_repositories'];

/**
 * GitHub Webhook Handler
 *
 * Handles:
 * - ping: Webhook setup verification
 * - pull_request.opened: Detect PRs that reference bounty issues
 * - pull_request.closed + merged: Mark bounty as ready for approval
 * - installation: GitHub App installed/uninstalled
 * - installation_repositories: Repos added/removed from installation
 *
 * Security:
 * - App-level events verified with GITHUB_APP_WEBHOOK_SECRET
 * - Repo-level events verified with per-repo webhookSecret
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();

    // Get headers
    const signature = request.headers.get('x-hub-signature-256');
    const event = request.headers.get('x-github-event');
    const deliveryId = request.headers.get('x-github-delivery');

    if (!signature || !event) {
      return NextResponse.json({ error: 'Missing required headers' }, { status: 400 });
    }

    // Parse payload
    let payload:
      | PullRequestEvent
      | IssueEvent
      | PingEvent
      | InstallationEvent
      | InstallationRepositoriesEvent;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    // Handle app-level events (installation, installation_repositories)
    if (APP_LEVEL_EVENTS.includes(event)) {
      const appSecret = process.env.GITHUB_APP_WEBHOOK_SECRET;
      if (!appSecret) {
        console.error('[webhook] Missing GITHUB_APP_WEBHOOK_SECRET for app-level event');
        return NextResponse.json({ error: 'App webhook not configured' }, { status: 500 });
      }

      const isValid = verifyWebhookSignature(rawBody, signature, appSecret);
      if (!isValid) {
        console.error(`[webhook] Invalid app signature for delivery ${deliveryId}`);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }

      switch (event) {
        case 'installation':
          return handleInstallation(payload as InstallationEvent);
        case 'installation_repositories':
          return handleInstallationRepositories(payload as InstallationRepositoriesEvent);
        default:
          return NextResponse.json({ message: 'Event ignored' }, { status: 200 });
      }
    }

    // Handle repo-level events (pull_request, issues, ping)
    // These require a repository ID and per-repo webhook secret
    const repoId = (payload as PullRequestEvent | IssueEvent | PingEvent).repository?.id;
    if (!repoId) {
      return NextResponse.json({ error: 'Missing repository ID' }, { status: 400 });
    }

    // Find repo settings by GitHub repo ID
    const [repo] = await db
      .select()
      .from(repoSettings)
      .where(eq(repoSettings.githubRepoId, BigInt(repoId)))
      .limit(1);

    if (!repo) {
      // Repo not registered with GRIP
      return NextResponse.json({ message: 'Repository not registered' }, { status: 200 });
    }

    // Verify webhook signature with per-repo secret
    if (!repo.webhookSecret) {
      console.error(`[webhook] Repo ${repo.githubRepoId} has no webhook secret`);
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
    }

    const isValid = verifyWebhookSignature(rawBody, signature, repo.webhookSecret);
    if (!isValid) {
      console.error(`[webhook] Invalid signature for delivery ${deliveryId}`);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Handle event
    switch (event) {
      case 'ping':
        return handlePing(payload as PingEvent);

      case 'pull_request':
        return handlePullRequest(payload as PullRequestEvent, repo);

      case 'issues':
        return handleIssue(payload as IssueEvent, repo);

      default:
        // Ignore other events
        return NextResponse.json({ message: 'Event ignored' }, { status: 200 });
    }
  } catch (error) {
    console.error('[webhook] Error processing webhook:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Handle ping event (webhook setup verification)
 */
function handlePing(payload: PingEvent): NextResponse {
  console.log(`[webhook] Ping received: ${payload.zen}`);
  return NextResponse.json({ message: 'pong', zen: payload.zen });
}

/**
 * Handle pull request events
 *
 * - opened: Check if PR references a bounty issue, mark submission as submitted
 * - closed + merged: Mark bounty ready for approval
 */
async function handlePullRequest(
  payload: PullRequestEvent,
  repo: typeof repoSettings.$inferSelect
): Promise<NextResponse> {
  const { action, pull_request: pr } = payload;
  const prAuthor = pr.user.login;

  console.log(`[webhook] PR #${pr.number} ${action} by ${prAuthor}`);

  if (action === 'opened' || action === 'edited') {
    // Check if PR references any bounty issues
    const linkedIssues = extractLinkedIssues(pr.body);

    for (const issueNumber of linkedIssues) {
      // Find all bounties for this repo
      const allBounties = await db
        .select()
        .from(bounties)
        .where(
          and(
            eq(bounties.githubRepoId, BigInt(payload.repository.id)),
            eq(bounties.githubIssueNumber, issueNumber)
          )
        )
        .limit(1);

      const bounty = allBounties[0];

      // Skip if bounty doesn't exist or isn't open for work
      if (!bounty || bounty.status !== 'open') {
        continue;
      }

      // Create/update submission with PR info
      const submission = await findOrCreateSubmissionForGitHubUser(
        bounty.id,
        BigInt(pr.user.id), // GitHub user ID (not GRIP user ID)
        BigInt(pr.id), // GitHub PR ID
        pr.number,
        pr.html_url,
        pr.title
      );

      if (submission) {
        console.log(
          `[webhook] Bounty ${bounty.id} submission ${submission.id} created/updated with PR #${pr.number}`
        );

        // Notify bounty funder that PR was submitted
        // Wrapped in try-catch to not block webhook processing if notification fails
        if (bounty.primaryFunderId) {
          try {
            await notifyPrSubmitted({
              funderId: bounty.primaryFunderId,
              bountyId: bounty.id,
              bountyTitle: bounty.title,
              amount: bounty.totalFunded.toString(),
              tokenAddress: bounty.tokenAddress,
              submitterName: prAuthor,
              repoFullName: payload.repository.full_name,
              repoOwner: payload.repository.owner.login,
              repoName: payload.repository.name,
            });
          } catch (error) {
            console.error('[webhook] Failed to create PR submitted notification:', error);
          }
        }
      } else {
        console.log(`[webhook] PR author ${prAuthor} not registered with GRIP`);
      }
    }
  }

  if (action === 'closed' && pr.merged) {
    // PR was merged - mark submission as merged (ready for payment)
    const linkedIssues = extractLinkedIssues(pr.body);

    for (const issueNumber of linkedIssues) {
      // Find bounty by GitHub repo ID (works for permissionless bounties)
      const allBounties = await db
        .select()
        .from(bounties)
        .where(
          and(
            eq(bounties.githubRepoId, BigInt(payload.repository.id)),
            eq(bounties.githubIssueNumber, issueNumber)
          )
        )
        .limit(1);

      const bounty = allBounties[0];

      if (!bounty) {
        continue;
      }

      // Find or create GRIP user from GitHub username
      const userId = await findUserByGitHubUsername(prAuthor);

      if (!userId) {
        console.log(`[webhook] PR author ${prAuthor} not registered with GRIP`);
        continue;
      }

      // Find this user's submission
      const activeSubmissions = await getActiveSubmissionsForBounty(bounty.id);
      const userSubmission = activeSubmissions.find(
        (s: { submission: { userId: string } }) => s.submission.userId === userId
      );

      if (userSubmission) {
        // Mark submission as merged (ready for payment approval)
        await updateSubmissionStatus(userSubmission.submission.id, 'merged', {
          prMergedAt: new Date().toISOString(),
        });

        console.log(
          `[webhook] Bounty ${bounty.id} submission ${userSubmission.submission.id} marked merged, awaiting payment approval`
        );
      }
    }
  }

  if (action === 'closed' && !pr.merged) {
    // PR closed without merge - mark submission as rejected (abandoned)
    const linkedIssues = extractLinkedIssues(pr.body);

    for (const issueNumber of linkedIssues) {
      // Use repo-based lookup for permissionless bounties
      const allBounties = await db
        .select()
        .from(bounties)
        .where(
          and(
            eq(bounties.githubRepoId, BigInt(payload.repository.id)),
            eq(bounties.githubIssueNumber, issueNumber)
          )
        )
        .limit(1);

      const bounty = allBounties[0];

      if (!bounty) {
        continue;
      }

      // Find or create user's submission if they had one
      const userId = await findUserByGitHubUsername(prAuthor);
      if (!userId) {
        continue;
      }

      // Get all active submissions for this bounty
      const activeSubmissions = await getActiveSubmissionsForBounty(bounty.id);

      // Find this user's submission
      const userSubmission = activeSubmissions.find(
        (s: { submission: { userId: string; id: string } }) => s.submission.userId === userId
      );
      if (userSubmission) {
        // Mark their submission as rejected (PR closed without merge)
        await updateSubmissionStatus(userSubmission.submission.id, 'rejected', {
          rejectedAt: new Date().toISOString(),
          rejectionNote: `PR #${pr.number} closed without merge (abandoned)`,
        });

        console.log(
          `[webhook] Submission ${userSubmission.submission.id} rejected (PR #${pr.number} closed without merge)`
        );
      }

      // Reopen bounty only if NO other active submissions
      const remainingSubmissions = await getActiveSubmissionsForBounty(bounty.id);
      if (remainingSubmissions.length === 0) {
        await updateBountyStatus(bounty.id, 'open');
        console.log(`[webhook] Bounty ${bounty.id} reopened (no active submissions remaining)`);
      }
    }
  }

  return NextResponse.json({ message: 'Processed' });
}

/**
 * Handle issue events
 *
 * Currently just logs - could be used for:
 * - Auto-creating bounty drafts when issues get labeled
 * - Closing bounties when issues are closed
 */
async function handleIssue(
  payload: IssueEvent,
  repo: typeof repoSettings.$inferSelect
): Promise<NextResponse> {
  const { action, issue } = payload;

  console.log(`[webhook] Issue #${issue.number} ${action}`);

  if (action === 'closed') {
    // Check if this issue has a bounty that should be cancelled
    // Use repo-based lookup for permissionless bounties
    const allBounties = await db
      .select()
      .from(bounties)
      .where(
        and(
          eq(bounties.githubRepoId, BigInt(payload.repository.id)),
          eq(bounties.githubIssueNumber, issue.number)
        )
      )
      .limit(1);

    const bounty = allBounties[0];

    if (bounty && bounty.status === 'open') {
      // Issue closed without bounty being completed - cancel the bounty
      await updateBountyStatus(bounty.id, 'cancelled', {
        cancelledAt: new Date().toISOString(),
      });
      console.log(`[webhook] Bounty ${bounty.id} cancelled (issue closed)`);
    }
  }

  return NextResponse.json({ message: 'Processed' });
}

/**
 * Handle installation events (GitHub App installed/uninstalled)
 *
 * - deleted: Unclaim all repos for this installation
 */
async function handleInstallation(payload: InstallationEvent): Promise<NextResponse> {
  const { action, installation } = payload;

  console.log(
    `[webhook] Installation ${installation.id} ${action} for ${installation.account.login}`
  );

  if (action === 'deleted') {
    // App was uninstalled - unclaim all repos with this installation ID
    const unclaimed = await unclaimReposByInstallationId(BigInt(installation.id));
    console.log(
      `[webhook] Unclaimed ${unclaimed.length} repos for installation ${installation.id}`
    );
  }

  return NextResponse.json({ message: 'Processed' });
}

/**
 * Handle installation_repositories events (repos added/removed from installation)
 *
 * - removed: Unclaim the removed repos
 */
async function handleInstallationRepositories(
  payload: InstallationRepositoriesEvent
): Promise<NextResponse> {
  const { action, installation, repositories_removed } = payload;

  console.log(`[webhook] Installation ${installation.id} repositories ${action}`);

  if (action === 'removed' && repositories_removed) {
    // Repos were removed from installation - unclaim each one
    for (const repo of repositories_removed) {
      await unclaimRepoByGithubRepoId(BigInt(repo.id));
      console.log(`[webhook] Unclaimed repo ${repo.full_name} (${repo.id})`);
    }
  }

  return NextResponse.json({ message: 'Processed' });
}
