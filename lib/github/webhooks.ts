import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

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
 * Pull request event payload (simplified)
 */
export interface PullRequestEvent {
  action: 'opened' | 'closed' | 'reopened' | 'synchronize' | 'edited';
  number: number;
  pull_request: {
    id: number;
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    merged: boolean;
    user: {
      login: string;
      id: number;
    };
  };
  repository: {
    id: number;
    full_name: string;
    owner: {
      login: string;
    };
    name: string;
  };
}

/**
 * Issue event payload (simplified)
 */
export interface IssueEvent {
  action: 'opened' | 'closed' | 'labeled' | 'unlabeled' | 'edited';
  issue: {
    id: number;
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    labels: Array<{ name: string }>;
    user: {
      login: string;
      id: number;
    };
  };
  repository: {
    id: number;
    full_name: string;
    owner: {
      login: string;
    };
    name: string;
  };
  label?: {
    name: string;
  };
}

/**
 * Ping event (sent when webhook is created)
 */
export interface PingEvent {
  zen: string;
  hook_id: number;
  repository: {
    id: number;
    full_name: string;
  };
}

/**
 * Installation event (GitHub App installed/uninstalled)
 */
export interface InstallationEvent {
  action: 'created' | 'deleted' | 'suspend' | 'unsuspend' | 'new_permissions_accepted';
  installation: {
    id: number;
    account: {
      login: string;
      id: number;
    };
  };
  repositories?: Array<{
    id: number;
    full_name: string;
  }>;
}

/**
 * Installation repositories event (repos added/removed from installation)
 */
export interface InstallationRepositoriesEvent {
  action: 'added' | 'removed';
  installation: {
    id: number;
    account: {
      login: string;
      id: number;
    };
  };
  repositories_added?: Array<{
    id: number;
    full_name: string;
    private: boolean;
  }>;
  repositories_removed?: Array<{
    id: number;
    full_name: string;
    private: boolean;
  }>;
}

/**
 * Verify GitHub webhook signature
 *
 * GitHub signs webhooks using HMAC-SHA256.
 * The signature is in the X-Hub-Signature-256 header.
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!signature.startsWith('sha256=')) {
    return false;
  }

  const expectedSignature = createHmac('sha256', secret).update(payload).digest('hex');

  const providedSignature = signature.slice(7); // Remove "sha256=" prefix

  // Use timing-safe comparison to prevent timing attacks
  try {
    return timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    );
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
