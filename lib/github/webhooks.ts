import { Webhooks } from '@octokit/webhooks';
import { randomBytes } from 'node:crypto';

// Re-export types from @octokit/webhooks-types for consumers
export type {
  PullRequestEvent,
  IssuesEvent,
  PingEvent,
  InstallationEvent,
  InstallationRepositoriesEvent,
} from '@octokit/webhooks-types';

/**
 * GitHub webhook event types we handle
 */
export type GitHubWebhookEvent =
  | 'pull_request'
  | 'issues'
  | 'ping'
  | 'installation'
  | 'installation_repositories';

/**
 * Verify GitHub webhook signature
 *
 * GitHub signs webhooks using HMAC-SHA256.
 * The signature is in the X-Hub-Signature-256 header.
 *
 * @param payload - Raw request body as string
 * @param signature - X-Hub-Signature-256 header value
 * @param secret - Webhook secret (per-repo or app-level)
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const webhooks = new Webhooks({ secret });
    return await webhooks.verify(payload, signature);
  } catch {
    return false;
  }
}

/**
 * Extract linked issue numbers from PR body
 *
 * Looks for patterns like:
 * - "fixes #123"
 * - "closes #123"
 * - "resolves #123"
 * - "#123" (standalone)
 *
 * Case-insensitive matching.
 */
export function extractLinkedIssues(body: string | null): number[] {
  if (!body) return [];

  const issues: number[] = [];

  // Match common linking patterns
  const patterns = [
    /(?:fix(?:es)?|close[sd]?|resolve[sd]?)\s*#(\d+)/gi,
    /(?:^|\s)#(\d+)(?:\s|$)/gm, // Standalone issue references
  ];

  for (const pattern of patterns) {
    const matches = body.matchAll(pattern);
    for (const match of matches) {
      const issueNum = Number.parseInt(match[1], 10);
      if (!issues.includes(issueNum)) {
        issues.push(issueNum);
      }
    }
  }

  return issues;
}

/**
 * Check if PR body indicates it fixes a specific issue
 */
export function prFixesIssue(prBody: string | null, issueNumber: number): boolean {
  const linkedIssues = extractLinkedIssues(prBody);
  return linkedIssues.includes(issueNumber);
}

/**
 * Generate a random webhook secret
 */
export function generateWebhookSecret(): string {
  return randomBytes(32).toString('hex');
}
