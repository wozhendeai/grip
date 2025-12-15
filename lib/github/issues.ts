import { account, db } from '@/db';
import { and, eq } from 'drizzle-orm';

/**
 * GitHub Issue Operations
 *
 * Utilities for interacting with GitHub Issues API:
 * - Fetch issues for bounty creation
 * - Add bounty labels to issues
 * - Post comments on issues
 *
 * Uses the user's OAuth access token stored in the account table.
 */

const GITHUB_API_BASE = 'https://api.github.com';

/**
 * Bounty label configuration
 */
export const BOUNTY_LABEL = {
  name: 'bounty',
  color: '2ea44f', // GitHub green
  description: 'This issue has a bounty attached via BountyLane',
};

/**
 * Get GitHub access token for a user
 */
export async function getGitHubToken(userId: string): Promise<string | null> {
  const [githubAccount] = await db
    .select({
      accessToken: account.accessToken,
    })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, 'github')))
    .limit(1);

  return githubAccount?.accessToken ?? null;
}

/**
 * Make an authenticated GitHub API request
 */
async function githubFetch(
  token: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = path.startsWith('http') ? path : `${GITHUB_API_BASE}${path}`;

  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

/**
 * GitHub Issue type (simplified)
 */
export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: 'open' | 'closed';
  labels: Array<{ name: string; color: string }>;
  user: {
    id: number;
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
}

/**
 * Result from listOpenIssues with pagination metadata
 */
export interface IssuesResult {
  issues: GitHubIssue[];
  hasNextPage: boolean;
}

/**
 * Fetch a single issue from GitHub
 */
export async function getIssue(
  token: string,
  owner: string,
  repo: string,
  issueNumber: number
): Promise<GitHubIssue | null> {
  const response = await githubFetch(token, `/repos/${owner}/${repo}/issues/${issueNumber}`);

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`GitHub API error: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

/**
 * List open issues from a GitHub repository
 *
 * @param token GitHub access token
 * @param owner Repository owner
 * @param repo Repository name
 * @param options Optional filters
 */
export async function listOpenIssues(
  token: string,
  owner: string,
  repo: string,
  options: {
    perPage?: number;
    page?: number;
    labels?: string;
  } = {}
): Promise<IssuesResult> {
  const params = new URLSearchParams({
    state: 'open',
    per_page: String(options.perPage ?? 50),
    page: String(options.page ?? 1),
    sort: 'updated',
    direction: 'desc',
  });

  if (options.labels) {
    params.set('labels', options.labels);
  }

  const response = await githubFetch(token, `/repos/${owner}/${repo}/issues?${params}`);

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${await response.text()}`);
  }

  // Parse Link header for pagination metadata
  const linkHeader = response.headers.get('Link');
  const hasNextPage = linkHeader?.includes('rel="next"') ?? false;

  const issues = await response.json();

  // Filter out pull requests (GitHub API returns PRs as issues)
  const filteredIssues = issues.filter(
    (issue: GitHubIssue & { pull_request?: unknown }) => !issue.pull_request
  );

  return {
    issues: filteredIssues,
    hasNextPage,
  };
}

/**
 * Search issues in a GitHub repository using GitHub Search API
 *
 * Uses GitHub's search endpoint to search ALL issues in a repo (not just loaded ones).
 * Search is performed server-side by GitHub for better performance on large repos.
 *
 * @param token GitHub access token
 * @param owner Repository owner
 * @param repo Repository name
 * @param searchTerm Search query (searches title and body)
 * @param options Optional pagination settings
 */
export async function searchRepoIssues(
  token: string,
  owner: string,
  repo: string,
  searchTerm: string,
  options: {
    perPage?: number;
    page?: number;
  } = {}
): Promise<IssuesResult> {
  // Build GitHub search query: searches in specified repo, only open issues
  const query = `repo:${owner}/${repo} is:issue is:open ${searchTerm}`;

  const params = new URLSearchParams({
    q: query,
    per_page: String(options.perPage ?? 50),
    page: String(options.page ?? 1),
    sort: 'updated',
    order: 'desc',
  });

  const response = await githubFetch(token, `/search/issues?${params}`);

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${await response.text()}`);
  }

  // Parse Link header for pagination metadata
  const linkHeader = response.headers.get('Link');
  const hasNextPage = linkHeader?.includes('rel="next"') ?? false;

  const data = await response.json();

  // GitHub Search API returns { items: [], total_count: N }
  // Filter out pull requests (GitHub API returns PRs as issues)
  const filteredIssues = (data.items || []).filter(
    (issue: GitHubIssue & { pull_request?: unknown }) => !issue.pull_request
  );

  return {
    issues: filteredIssues,
    hasNextPage,
  };
}

/**
 * Add a label to a GitHub issue
 *
 * Creates the label if it doesn't exist.
 */
export async function addLabelToIssue(
  token: string,
  owner: string,
  repo: string,
  issueNumber: number,
  label: string = BOUNTY_LABEL.name
): Promise<void> {
  // First, ensure the label exists in the repository
  await ensureLabelExists(token, owner, repo, label);

  // Add the label to the issue
  const response = await githubFetch(
    token,
    `/repos/${owner}/${repo}/issues/${issueNumber}/labels`,
    {
      method: 'POST',
      body: JSON.stringify({ labels: [label] }),
    }
  );

  if (!response.ok && response.status !== 422) {
    // 422 means label already exists on issue, which is fine
    throw new Error(`Failed to add label: ${response.status} ${await response.text()}`);
  }
}

/**
 * Ensure a label exists in the repository
 */
async function ensureLabelExists(
  token: string,
  owner: string,
  repo: string,
  label: string
): Promise<void> {
  // Try to get the label
  const getResponse = await githubFetch(
    token,
    `/repos/${owner}/${repo}/labels/${encodeURIComponent(label)}`
  );

  if (getResponse.ok) {
    // Label already exists
    return;
  }

  if (getResponse.status !== 404) {
    throw new Error(`Failed to check label: ${getResponse.status}`);
  }

  // Create the label
  const createResponse = await githubFetch(token, `/repos/${owner}/${repo}/labels`, {
    method: 'POST',
    body: JSON.stringify({
      name: BOUNTY_LABEL.name,
      color: BOUNTY_LABEL.color,
      description: BOUNTY_LABEL.description,
    }),
  });

  if (!createResponse.ok && createResponse.status !== 422) {
    // 422 means label already exists (race condition), which is fine
    throw new Error(
      `Failed to create label: ${createResponse.status} ${await createResponse.text()}`
    );
  }
}

/**
 * Remove a label from a GitHub issue
 */
export async function removeLabelFromIssue(
  token: string,
  owner: string,
  repo: string,
  issueNumber: number,
  label: string = BOUNTY_LABEL.name
): Promise<void> {
  const response = await githubFetch(
    token,
    `/repos/${owner}/${repo}/issues/${issueNumber}/labels/${encodeURIComponent(label)}`,
    {
      method: 'DELETE',
    }
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to remove label: ${response.status} ${await response.text()}`);
  }
}

/**
 * Post a comment on a GitHub issue
 */
export async function commentOnIssue(
  token: string,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string
): Promise<{ id: number; html_url: string }> {
  const response = await githubFetch(
    token,
    `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    {
      method: 'POST',
      body: JSON.stringify({ body }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to post comment: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

/**
 * Generate bounty comment body
 */
export function generateBountyComment(params: {
  amount: string | number;
  tokenSymbol: string;
  claimDeadlineDays: number;
  bountyUrl: string;
}): string {
  const { amount, tokenSymbol, claimDeadlineDays, bountyUrl } = params;

  return `## 💰 Bounty: $${amount} ${tokenSymbol}

This issue has a bounty attached via [BountyLane](https://bountylane.xyz).

**Amount:** $${amount} ${tokenSymbol}
**Claim deadline:** ${claimDeadlineDays} days after claiming

### How to claim

1. Sign in to BountyLane with your GitHub account
2. Create a wallet (just needs your fingerprint/FaceID)
3. Click "Claim Bounty" on the bounty page
4. Submit a PR that fixes this issue
5. Get paid instantly when your PR is merged!

[**View bounty details →**](${bountyUrl})

---
<sub>Powered by [BountyLane](https://bountylane.xyz) - Open source bounties on Tempo blockchain</sub>`;
}
