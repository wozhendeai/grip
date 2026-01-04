import { githubFetch, githubFetchWithToken } from './index';

/**
 * GitHub API Operations
 *
 * All GitHub API operations consolidated:
 * - User operations (profiles, activity)
 * - Repo operations (metadata, permissions)
 * - Issue operations (fetch, labels, comments)
 */

// ============ Types ============

export type GitHubUser = {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  bio: string | null;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
  html_url: string;
  blog: string | null;
  location: string | null;
  twitter_username: string | null;
};

export type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string; avatar_url: string; id: number };
  description: string | null;
  private: boolean;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  created_at: string;
  updated_at: string;
  default_branch: string;
};

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

export interface IssuesResult {
  issues: GitHubIssue[];
  hasNextPage: boolean;
}

/**
 * Activity level based on recent contributions
 */
export type ActivityLevel = 'active' | 'recent' | 'inactive';

/**
 * GitHub user activity summary
 */
export type GitHubActivity = {
  lastActiveAt: string | null; // ISO timestamp of last public event
  activityLevel: ActivityLevel;
};

/**
 * GitHub Event from Events API (simplified)
 */
type GitHubEvent = {
  id: string;
  type: string;
  created_at: string;
};

// ============ Constants ============

/**
 * Bounty label configuration
 */
export const BOUNTY_LABEL = {
  name: 'bounty',
  color: '2ea44f', // GitHub green
  description: 'This issue has a bounty attached via GRIP',
};

// ============ User Operations ============

/**
 * Fetch GitHub user profile by username (uses server token)
 *
 * Caches for 1 hour since user profiles don't change frequently.
 * Returns null if user doesn't exist.
 */
export async function fetchGitHubUser(username: string): Promise<GitHubUser | null> {
  return githubFetch<GitHubUser>(`/users/${username}`, {
    next: { revalidate: 3600 }, // Cache 1 hour
  });
}

/**
 * Fetch GitHub user activity to determine if they're an active contributor (uses server token)
 *
 * Fetches recent public events to show credibility signals.
 * Filters out passive events (WatchEvent, ForkEvent) that don't indicate real contributions.
 *
 * Activity levels:
 * - active: < 7 days since last activity
 * - recent: 7-30 days since last activity
 * - inactive: > 30 days or no events
 *
 * Caches for 1 hour to minimize API requests while staying reasonably fresh.
 */
export async function fetchGitHubUserActivity(username: string): Promise<GitHubActivity> {
  try {
    // Fetch recent public events (max 30 to ensure we find a real contribution)
    // Filter out passive events that don't indicate real activity
    const events = await githubFetch<GitHubEvent[]>(
      `/users/${username}/events/public?per_page=30`,
      {
        next: { revalidate: 3600 }, // Cache 1 hour
      }
    );

    if (!events || events.length === 0) {
      return { lastActiveAt: null, activityLevel: 'inactive' };
    }

    // Filter out passive events (WatchEvent = starring repos, ForkEvent = forking without contribution)
    // Keep events that indicate real activity: PushEvent, PullRequestEvent, IssuesEvent, etc.
    const activeEvents = events.filter(
      (event) => event.type !== 'WatchEvent' && event.type !== 'ForkEvent'
    );

    if (activeEvents.length === 0) {
      return { lastActiveAt: null, activityLevel: 'inactive' };
    }

    // Get most recent active event
    const lastEvent = activeEvents[0];
    const lastActiveAt = lastEvent.created_at;

    // Calculate activity level based on recency
    const now = new Date();
    const lastActiveDate = new Date(lastActiveAt);
    const diffInDays = Math.floor(
      (now.getTime() - lastActiveDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    let activityLevel: ActivityLevel;
    if (diffInDays < 7) {
      activityLevel = 'active';
    } else if (diffInDays < 30) {
      activityLevel = 'recent';
    } else {
      activityLevel = 'inactive';
    }

    return { lastActiveAt, activityLevel };
  } catch (error) {
    // Graceful degradation on error (rate limits, API issues)
    // Return inactive instead of throwing - profile page should still render
    console.error('Failed to fetch GitHub activity:', error);
    return { lastActiveAt: null, activityLevel: 'inactive' };
  }
}

// ============ Repo Operations ============

/**
 * Fetch GitHub repository by owner/repo (uses server token)
 *
 * Caches for 1 hour since repo metadata doesn't change frequently.
 * Returns null if repo doesn't exist.
 */
export async function fetchGitHubRepo(owner: string, repo: string): Promise<GitHubRepo | null> {
  return githubFetch<GitHubRepo>(`/repos/${owner}/${repo}`, {
    next: { revalidate: 3600 }, // Cache 1 hour
  });
}

/**
 * Check if user has write or admin access to a repository (uses server token)
 *
 * Used to determine if user can create bounties on unclaimed repos.
 * Caches for 1 hour.
 */
export async function canUserManageRepo(
  owner: string,
  repo: string,
  username: string
): Promise<boolean> {
  const permission = await githubFetch<{ permission: string }>(
    `/repos/${owner}/${repo}/collaborators/${username}/permission`,
    { next: { revalidate: 3600 } }
  );

  return permission?.permission === 'admin' || permission?.permission === 'write';
}

/**
 * Check if user is a collaborator on a repository (any permission level)
 *
 * Used to enforce contributor eligibility settings.
 * Returns true if user has any collaborator access (read, triage, write, maintain, or admin).
 * Returns false if user is not a collaborator or if check fails.
 */
export async function isUserCollaborator(
  owner: string,
  repo: string,
  username: string
): Promise<boolean> {
  const permission = await githubFetch<{ permission: string }>(
    `/repos/${owner}/${repo}/collaborators/${username}/permission`,
    { next: { revalidate: 300 } } // Cache 5 min (shorter than canUserManageRepo)
  );

  // Any non-null permission means they're a collaborator
  return permission !== null;
}

/**
 * Fetch a GitHub user's public repositories (uses server token)
 *
 * Uses public API with server GITHUB_TOKEN (no user auth required).
 * Caches for 1 hour. Returns empty array if user not found.
 */
export async function fetchGitHubUserRepositories(
  username: string,
  options: {
    sort?: 'created' | 'updated' | 'pushed' | 'full_name';
    perPage?: number;
  } = {}
): Promise<GitHubRepo[]> {
  const { sort = 'updated', perPage = 30 } = options;

  const data = await githubFetch<GitHubRepo[]>(
    `/users/${username}/repos?sort=${sort}&per_page=${perPage}&type=public`,
    { next: { revalidate: 3600 } }
  );

  return data ?? [];
}

/**
 * Fetch organization's public repositories (uses server token)
 * Caches for 1 hour. Returns empty array if org not found.
 */
export async function fetchGitHubOrgRepositories(
  orgLogin: string,
  options: {
    sort?: 'created' | 'updated' | 'pushed' | 'full_name';
    perPage?: number;
  } = {}
): Promise<GitHubRepo[]> {
  const { sort = 'updated', perPage = 30 } = options;

  const data = await githubFetch<GitHubRepo[]>(
    `/orgs/${orgLogin}/repos?sort=${sort}&per_page=${perPage}&type=public`,
    { next: { revalidate: 3600 } }
  );

  return data ?? [];
}

// ============ Issue Operations (Requires User OAuth Token) ============

/**
 * Fetch a single issue from GitHub (requires user token)
 */
export async function getIssue(
  token: string,
  owner: string,
  repo: string,
  issueNumber: number
): Promise<GitHubIssue | null> {
  const response = await githubFetchWithToken(
    token,
    `/repos/${owner}/${repo}/issues/${issueNumber}`
  );

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`GitHub API error: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

/**
 * List open issues from a GitHub repository (requires user token)
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

  const response = await githubFetchWithToken(token, `/repos/${owner}/${repo}/issues?${params}`);

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
 * Search issues in a GitHub repository using GitHub Search API (requires user token)
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

  const response = await githubFetchWithToken(token, `/search/issues?${params}`);

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
 * Add a label to a GitHub issue (requires user token)
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
  const response = await githubFetchWithToken(
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
  const getResponse = await githubFetchWithToken(
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
  const createResponse = await githubFetchWithToken(token, `/repos/${owner}/${repo}/labels`, {
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
 * Remove a label from a GitHub issue (requires user token)
 */
export async function removeLabelFromIssue(
  token: string,
  owner: string,
  repo: string,
  issueNumber: number,
  label: string = BOUNTY_LABEL.name
): Promise<void> {
  const response = await githubFetchWithToken(
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
 * Post a comment on a GitHub issue (requires user token)
 */
export async function commentOnIssue(
  token: string,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string
): Promise<{ id: number; html_url: string }> {
  const response = await githubFetchWithToken(
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

This issue has a bounty attached via [GRIP](https://usegrip.xyz).

**Amount:** $${amount} ${tokenSymbol}
**Claim deadline:** ${claimDeadlineDays} days after claiming

### How to claim

1. Sign in to GRIP with your GitHub account
2. Create a wallet (just needs your fingerprint/FaceID)
3. Click "Claim Bounty" on the bounty page
4. Submit a PR that fixes this issue
5. Get paid instantly when your PR is merged!

[**View bounty details →**](${bountyUrl})

---
<sub>Powered by [GRIP](https://usegrip.xyz) - Open source bounties on Tempo blockchain</sub>`;
}
