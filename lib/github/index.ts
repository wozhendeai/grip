import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { account, db } from '@/db';
import { and, eq } from 'drizzle-orm';

/**
 * GitHub API Client
 *
 * Octokit clients for three auth contexts:
 * 1. serverOctokit - Server token for public data (5000 req/hour)
 * 2. userOctokit - User OAuth token for authenticated operations
 * 3. installationOctokit - GitHub App installation token (auto-managed)
 */

// ============ Octokit Clients ============

/**
 * Server token client for public data
 *
 * Use for: Public repos, user profiles, public activity
 * Rate limit: 5000 requests/hour
 */
export const serverOctokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

/**
 * Create a client with user's OAuth token
 *
 * Use for: Creating issues, adding labels, commenting, private repos
 * Rate limit: Per-user (typically 5000 requests/hour)
 */
export function userOctokit(token: string): Octokit {
  return new Octokit({ auth: token });
}

/**
 * Create a client for a GitHub App installation
 *
 * Octokit handles JWT generation and installation token caching internally.
 * Tokens are cached for ~55 minutes (they expire after 1 hour).
 */
export function installationOctokit(installationId: number | string | bigint): Octokit {
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('Missing GITHUB_APP_PRIVATE_KEY environment variable');
  }

  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: process.env.GITHUB_APP_ID!,
      privateKey: privateKey.replace(/\\n/g, '\n'),
      installationId: Number(installationId),
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
