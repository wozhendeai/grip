import { githubApi } from './client';

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

/**
 * Fetch GitHub repository by owner/repo
 *
 * Caches for 1 hour since repo metadata doesn't change frequently.
 * Returns null if repo doesn't exist.
 */
export async function fetchGitHubRepo(owner: string, repo: string): Promise<GitHubRepo | null> {
  return githubApi.fetch<GitHubRepo>(`/repos/${owner}/${repo}`, {
    next: { revalidate: 3600 }, // Cache 1 hour
  });
}

/**
 * Check if user has write or admin access to a repository
 *
 * Used to determine if user can create bounties on unclaimed repos.
 * Caches for 1 hour.
 */
export async function canUserManageRepo(
  owner: string,
  repo: string,
  username: string
): Promise<boolean> {
  const permission = await githubApi.fetch<{ permission: string }>(
    `/repos/${owner}/${repo}/collaborators/${username}/permission`,
    { next: { revalidate: 3600 } }
  );

  return permission?.permission === 'admin' || permission?.permission === 'write';
}

/**
 * Fetch a GitHub user's public repositories
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

  const data = await githubApi.fetch<GitHubRepo[]>(
    `/users/${username}/repos?sort=${sort}&per_page=${perPage}&type=public`,
    { next: { revalidate: 3600 } }
  );

  return data ?? [];
}
