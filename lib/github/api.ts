import type { RestEndpointMethodTypes } from '@octokit/rest';
import { serverOctokit, userOctokit } from './index';

/**
 * GitHub API Operations
 *
 * Thin wrappers around Octokit with caching.
 * Uses serverOctokit for public data, userOctokit for authenticated operations.
 */

// ============ Types ============

export type GitHubUser = RestEndpointMethodTypes['users']['getByUsername']['response']['data'];
export type GitHubRepo = RestEndpointMethodTypes['repos']['get']['response']['data'];
export type GitHubRepoMinimal =
  RestEndpointMethodTypes['repos']['listForUser']['response']['data'][number];
export type GitHubIssue = RestEndpointMethodTypes['issues']['get']['response']['data'];

export interface IssuesResult {
  issues: GitHubIssue[];
  hasNextPage: boolean;
}

export type ActivityLevel = 'active' | 'recent' | 'inactive';

export type GitHubActivity = {
  lastActiveAt: string | null;
  activityLevel: ActivityLevel;
};

// ============ Constants ============

export const BOUNTY_LABEL = {
  name: 'bounty',
  color: '2ea44f',
  description: 'This issue has a bounty attached via GRIP',
};

// ============ User Operations ============

/**
 * Fetch GitHub user profile by username (uses server token)
 *
 * Returns null if user doesn't exist.
 */
export async function fetchGitHubUser(username: string): Promise<GitHubUser | null> {
  try {
    const { data } = await serverOctokit.users.getByUsername({ username });
    return data;
  } catch (error) {
    if ((error as { status?: number }).status === 404) return null;
    throw error;
  }
}

/**
 * Fetch GitHub user activity to determine if they're an active contributor
 *
 * Activity levels:
 * - active: < 7 days since last activity
 * - recent: 7-30 days since last activity
 * - inactive: > 30 days or no events
 */
export async function fetchGitHubUserActivity(username: string): Promise<GitHubActivity> {
  try {
    const { data: events } = await serverOctokit.activity.listPublicEventsForUser({
      username,
      per_page: 30,
    });

    if (events.length === 0) {
      return { lastActiveAt: null, activityLevel: 'inactive' };
    }

    // Filter out passive events (WatchEvent = starring, ForkEvent = forking without contribution)
    const activeEvents = events.filter(
      (event) => event.type !== 'WatchEvent' && event.type !== 'ForkEvent'
    );

    if (activeEvents.length === 0) {
      return { lastActiveAt: null, activityLevel: 'inactive' };
    }

    const lastEvent = activeEvents[0];
    const lastActiveAt = lastEvent.created_at;

    if (!lastActiveAt) {
      return { lastActiveAt: null, activityLevel: 'inactive' };
    }

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
  } catch {
    return { lastActiveAt: null, activityLevel: 'inactive' };
  }
}

// ============ Repo Operations ============

/**
 * Fetch GitHub repository by owner/repo (uses server token)
 *
 * Returns null if repo doesn't exist.
 */
export async function fetchGitHubRepo(owner: string, repo: string): Promise<GitHubRepo | null> {
  try {
    const { data } = await serverOctokit.repos.get({ owner, repo });
    return data;
  } catch (error) {
    if ((error as { status?: number }).status === 404) return null;
    throw error;
  }
}

/**
 * Check if user has write or admin access to a repository
 *
 * Used to determine if user can create bounties on unclaimed repos.
 */
export async function canUserManageRepo(
  owner: string,
  repo: string,
  username: string
): Promise<boolean> {
  try {
    const { data } = await serverOctokit.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username,
    });
    return data.permission === 'admin' || data.permission === 'write';
  } catch {
    return false;
  }
}

/**
 * Check if user is a collaborator on a repository (any permission level)
 *
 * Returns true if user has any collaborator access (read, triage, write, maintain, or admin).
 */
export async function isUserCollaborator(
  owner: string,
  repo: string,
  username: string
): Promise<boolean> {
  try {
    await serverOctokit.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch a GitHub user's public repositories (uses server token)
 */
export async function fetchGitHubUserRepositories(
  username: string,
  options: {
    sort?: 'created' | 'updated' | 'pushed' | 'full_name';
    perPage?: number;
  } = {}
): Promise<GitHubRepoMinimal[]> {
  const { sort = 'updated', perPage = 30 } = options;

  try {
    const { data } = await serverOctokit.repos.listForUser({
      username,
      sort,
      per_page: perPage,
      type: 'owner',
    });
    // Filter to public repos only (GitHub API returns all for owner type)
    return data.filter((repo) => !repo.private);
  } catch {
    return [];
  }
}

/**
 * Fetch organization's public repositories (uses server token)
 */
export async function fetchGitHubOrgRepositories(
  org: string,
  options: {
    sort?: 'created' | 'updated' | 'pushed' | 'full_name';
    perPage?: number;
  } = {}
): Promise<GitHubRepoMinimal[]> {
  const { sort = 'updated', perPage = 30 } = options;

  try {
    const { data } = await serverOctokit.repos.listForOrg({
      org,
      sort,
      per_page: perPage,
    });
    // Filter to public repos only
    return data.filter((repo) => !repo.private);
  } catch {
    return [];
  }
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
  try {
    const { data } = await userOctokit(token).issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });
    return data;
  } catch (error) {
    if ((error as { status?: number }).status === 404) return null;
    throw error;
  }
}

/**
 * List open issues from a GitHub repository (requires user token)
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
  const octokit = userOctokit(token);

  const { data, headers } = await octokit.issues.listForRepo({
    owner,
    repo,
    state: 'open',
    per_page: options.perPage ?? 50,
    page: options.page ?? 1,
    sort: 'updated',
    direction: 'desc',
    labels: options.labels,
  });

  const linkHeader = headers.link;
  const hasNextPage = linkHeader?.includes('rel="next"') ?? false;

  // Filter out pull requests (GitHub API returns PRs as issues)
  const issues = data.filter((issue) => !issue.pull_request);

  return { issues, hasNextPage };
}

/**
 * Search issues in a GitHub repository using GitHub Search API (requires user token)
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
  const octokit = userOctokit(token);

  const query = `repo:${owner}/${repo} is:issue is:open ${searchTerm}`;

  const { data, headers } = await octokit.search.issuesAndPullRequests({
    q: query,
    per_page: options.perPage ?? 50,
    page: options.page ?? 1,
    sort: 'updated',
    order: 'desc',
  });

  const linkHeader = headers.link;
  const hasNextPage = linkHeader?.includes('rel="next"') ?? false;

  // Filter out pull requests
  const issues = data.items.filter((issue) => !issue.pull_request);

  return { issues: issues as GitHubIssue[], hasNextPage };
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
  const octokit = userOctokit(token);

  // Ensure the label exists in the repository
  await ensureLabelExists(octokit, owner, repo, label);

  // Add the label to the issue
  try {
    await octokit.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels: [label],
    });
  } catch (error) {
    // 422 means label already exists on issue, which is fine
    if ((error as { status?: number }).status !== 422) {
      throw error;
    }
  }
}

/**
 * Ensure a label exists in the repository
 */
async function ensureLabelExists(
  octokit: ReturnType<typeof userOctokit>,
  owner: string,
  repo: string,
  label: string
): Promise<void> {
  try {
    await octokit.issues.getLabel({
      owner,
      repo,
      name: label,
    });
  } catch (error) {
    if ((error as { status?: number }).status === 404) {
      // Create the label
      try {
        await octokit.issues.createLabel({
          owner,
          repo,
          name: BOUNTY_LABEL.name,
          color: BOUNTY_LABEL.color,
          description: BOUNTY_LABEL.description,
        });
      } catch (createError) {
        // 422 means label already exists (race condition), which is fine
        if ((createError as { status?: number }).status !== 422) {
          throw createError;
        }
      }
    } else {
      throw error;
    }
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
  try {
    await userOctokit(token).issues.removeLabel({
      owner,
      repo,
      issue_number: issueNumber,
      name: label,
    });
  } catch (error) {
    // 404 means label wasn't on issue, which is fine
    if ((error as { status?: number }).status !== 404) {
      throw error;
    }
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
  const { data } = await userOctokit(token).issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });

  return { id: data.id, html_url: data.html_url };
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

// ============ Organization Types ============

export type GitHubOrganization = RestEndpointMethodTypes['orgs']['get']['response']['data'];

/**
 * Minimal organization info for display purposes.
 * Compatible with both full GitHub API response and placeholders.
 */
export interface GitHubOrganizationMinimal {
  id: number;
  login: string;
  avatar_url: string;
  description?: string | null;
  name?: string | null;
  blog?: string | null;
  location?: string | null;
  email?: string | null;
  public_repos?: number;
  public_gists?: number;
  followers?: number;
  created_at: string;
  updated_at: string;
  html_url: string;
}

export type GitHubOrgMembership =
  RestEndpointMethodTypes['orgs']['getMembershipForAuthenticatedUser']['response']['data'];

export type GitHubMember =
  RestEndpointMethodTypes['orgs']['listMembers']['response']['data'][number];

// ============ Organization Operations ============

/**
 * Get public organization info
 *
 * Returns: Organization details or null if not found
 */
export async function getOrganization(orgLogin: string): Promise<GitHubOrganization | null> {
  try {
    const { data } = await serverOctokit.orgs.get({ org: orgLogin });
    return data;
  } catch (error) {
    if ((error as { status?: number }).status === 404) return null;
    throw error;
  }
}

/**
 * List user's organizations
 *
 * Scope required: read:org
 * Returns: Array of organizations user belongs to (empty array on error)
 */
export async function getUserOrganizations(
  token: string
): Promise<RestEndpointMethodTypes['orgs']['listForAuthenticatedUser']['response']['data']> {
  try {
    const { data } = await userOctokit(token).orgs.listForAuthenticatedUser();
    return data;
  } catch (error) {
    if ((error as { status?: number }).status === 403) {
      console.info('GitHub organizations: read:org scope required');
      throw new Error('GitHub API error: 403');
    }
    console.error('Failed to fetch user orgs:', error);
    return [];
  }
}

/**
 * Check user's membership in an organization
 *
 * Scope required: read:org
 * Returns: Membership details or null if user is not a member
 */
export async function getUserOrgMembership(
  token: string,
  orgLogin: string
): Promise<GitHubOrgMembership | null> {
  try {
    const { data } = await userOctokit(token).orgs.getMembershipForAuthenticatedUser({
      org: orgLogin,
    });
    return data;
  } catch (error) {
    if ((error as { status?: number }).status === 404) return null;
    throw error;
  }
}

/**
 * List organization members (single page)
 *
 * Scope required: read:org (or org admin)
 * Supports role filtering: 'all', 'admin', 'member'
 */
export async function getOrgMembers(
  token: string,
  orgLogin: string,
  page = 1,
  perPage = 100,
  role: 'admin' | 'member' | 'all' = 'all'
): Promise<GitHubMember[]> {
  try {
    const { data } = await userOctokit(token).orgs.listMembers({
      org: orgLogin,
      page,
      per_page: perPage,
      role: role === 'all' ? undefined : role,
    });
    return data;
  } catch (error) {
    console.error('Failed to fetch org members:', error);
    return [];
  }
}

/**
 * Get all organization members (handles pagination)
 *
 * Supports role filtering: 'all', 'admin', 'member'
 */
export async function getAllOrgMembers(
  token: string,
  orgLogin: string,
  role: 'admin' | 'member' | 'all' = 'all'
): Promise<GitHubMember[]> {
  const octokit = userOctokit(token);

  try {
    return await octokit.paginate(octokit.orgs.listMembers, {
      org: orgLogin,
      per_page: 100,
      role: role === 'all' ? undefined : role,
    });
  } catch (error) {
    console.error('Failed to fetch all org members:', error);
    return [];
  }
}

/**
 * Get all organization members with role information
 *
 * Fetches both all members and admins in parallel.
 */
export async function getAllOrgMembersByRole(
  token: string,
  orgLogin: string
): Promise<{ admins: GitHubMember[]; allMembers: GitHubMember[] }> {
  const [admins, allMembers] = await Promise.all([
    getAllOrgMembers(token, orgLogin, 'admin'),
    getAllOrgMembers(token, orgLogin, 'all'),
  ]);

  return { admins, allMembers };
}
