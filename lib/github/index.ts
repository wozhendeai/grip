import { account, db } from '@/db';
import { and, eq } from 'drizzle-orm';

/**
 * GitHub API Client
 *
 * Unified client for GitHub API operations with two auth contexts:
 * 1. Server token (GITHUB_TOKEN) - for public data
 * 2. User OAuth token - for authenticated operations
 */

const GITHUB_API_BASE = 'https://api.github.com';

// ============ Server Token Fetch (Public Data) ============

/**
 * Fetch GitHub API with server token (GITHUB_TOKEN)
 *
 * Use for: Public repos, user profiles, public activity
 * Rate limit: 5000 requests/hour
 *
 * Returns null on 404, throws on other errors
 */
export async function githubFetch<T>(
  endpoint: string,
  options?: RequestInit & { next?: { revalidate?: number } }
): Promise<T | null> {
  const res = await fetch(`${GITHUB_API_BASE}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
    ...options,
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    console.error(`GitHub API error: ${res.status} ${res.statusText}`);
    throw new Error(`GitHub API error: ${res.status}`);
  }

  return res.json();
}

// ============ User OAuth Token Fetch (Authenticated Actions) ============

/**
 * Fetch GitHub API with user's OAuth token
 *
 * Use for: Creating issues, adding labels, commenting, private repos
 * Rate limit: Per-user (typically 5000 requests/hour)
 *
 * Returns Response object (caller must check .ok and parse JSON)
 * Handles full URLs or paths
 */
export async function githubFetchWithToken(
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

// ============ Token Management ============

/**
 * Get user's GitHub OAuth token from database
 * Returns null if user hasn't connected GitHub account
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

// ============ Re-exports ============

export * from './api';
export * from './app';
export * from './webhooks';
