/**
 * GitHub App Authentication
 *
 * Utilities for GitHub App JWT generation, installation tokens, and claim state signing.
 * Used for the repository claiming flow.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { importPKCS8, SignJWT } from 'jose';

const GITHUB_API_BASE = 'https://api.github.com';

// Installation token cache (in-memory, 55 min TTL to account for clock skew)
const tokenCache = new Map<string, { token: string; expiresAt: Date }>();

// ============ Types ============

export interface ClaimState {
  userId: string;
  owner: string;
  repo: string;
  timestamp: number;
  callbackUrl?: string; // Origin callback URL for dev proxy
}

export interface InstallationRepo {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  private: boolean;
  owner: {
    login: string;
    id: number;
  };
}

// ============ App JWT ============

/**
 * Generate a JWT for GitHub App authentication
 *
 * Used to authenticate as the GitHub App itself (not as an installation).
 * JWT is signed with RS256 using the App's private key.
 * Valid for 10 minutes (GitHub's maximum).
 */
export async function generateAppJWT(): Promise<string> {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKey) {
    throw new Error('Missing GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY environment variables');
  }

  // Handle escaped newlines in env var
  const formattedKey = privateKey.replace(/\\n/g, '\n');

  const key = await importPKCS8(formattedKey, 'RS256');
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt(now - 60) // Allow 60s clock skew
    .setExpirationTime(now + 10 * 60) // 10 min max
    .setIssuer(appId)
    .sign(key);
}

// ============ Installation Tokens ============

/**
 * Get an installation access token for a GitHub App installation
 *
 * Tokens are cached for 55 minutes (they expire after 1 hour).
 * Used to make API calls on behalf of a specific installation.
 */
export async function getInstallationToken(installationId: string | bigint): Promise<string> {
  const id = installationId.toString();
  const cached = tokenCache.get(id);

  // Return cached token if still valid (5 min buffer)
  if (cached && cached.expiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
    return cached.token;
  }

  // Get new token from GitHub
  const appJwt = await generateAppJWT();

  const response = await fetch(`${GITHUB_API_BASE}/app/installations/${id}/access_tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${appJwt}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[github-app] Failed to get installation token: ${error}`);
    throw new Error(`Failed to get installation token: ${response.status}`);
  }

  const data = (await response.json()) as { token: string; expires_at: string };

  // Cache with 55 min TTL (tokens last 1 hour)
  tokenCache.set(id, {
    token: data.token,
    expiresAt: new Date(data.expires_at),
  });

  return data.token;
}

/**
 * Get all repositories accessible to a GitHub App installation
 */
export async function getInstallationRepos(
  installationId: string | bigint
): Promise<InstallationRepo[]> {
  const token = await getInstallationToken(installationId);

  const repos: InstallationRepo[] = [];
  let page = 1;
  const perPage = 100;

  // Paginate through all repos
  while (true) {
    const response = await fetch(
      `${GITHUB_API_BASE}/installation/repositories?per_page=${perPage}&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`[github-app] Failed to get installation repos: ${error}`);
      throw new Error(`Failed to get installation repos: ${response.status}`);
    }

    const data = (await response.json()) as {
      repositories: InstallationRepo[];
      total_count: number;
    };
    repos.push(...data.repositories);

    if (repos.length >= data.total_count) {
      break;
    }
    page++;
  }

  return repos;
}

// ============ Claim State Signing ============

const STATE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Sign a claim state for the GitHub App installation flow
 *
 * State is base64url encoded and signed with HMAC-SHA256.
 * Format: {base64url(state)}.{signature}
 */
export function signClaimState(state: ClaimState): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error('Missing BETTER_AUTH_SECRET environment variable');
  }

  const data = Buffer.from(JSON.stringify(state)).toString('base64url');
  const signature = createHmac('sha256', secret).update(data).digest('hex');

  return `${data}.${signature}`;
}

/**
 * Verify and decode a signed claim state
 *
 * Returns null if:
 * - Signature is invalid
 * - State is expired (>10 minutes old)
 * - State is malformed
 */
export function verifyClaimState(signedState: string): ClaimState | null {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    console.error('[github-app] Missing BETTER_AUTH_SECRET');
    return null;
  }

  const parts = signedState.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [data, signature] = parts;

  // Verify signature using constant-time comparison
  const expectedSignature = createHmac('sha256', secret).update(data).digest('hex');

  if (signature.length !== expectedSignature.length) {
    return null;
  }

  if (!timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'))) {
    return null;
  }

  // Decode and validate state
  try {
    const state = JSON.parse(Buffer.from(data, 'base64url').toString()) as ClaimState;

    // Check expiration
    if (Date.now() - state.timestamp > STATE_EXPIRY_MS) {
      console.log('[github-app] State expired');
      return null;
    }

    // Validate required fields
    if (!state.userId || !state.owner || !state.repo || !state.timestamp) {
      return null;
    }

    return state;
  } catch {
    return null;
  }
}

// ============ Utility ============

/**
 * Build the GitHub App installation URL for a specific repository
 */
export function getInstallUrl(owner: string, repo: string, state: string): string {
  const appSlug = process.env.GITHUB_APP_SLUG || 'grip-bounties';
  const encodedState = encodeURIComponent(state);

  // Suggest installing on specific repo
  return `https://github.com/apps/${appSlug}/installations/new/permissions?suggested_target_id=${owner}&repository_ids=&state=${encodedState}`;
}

/**
 * Build the simple GitHub App installation URL
 */
export function getSimpleInstallUrl(state: string): string {
  const appSlug = process.env.GITHUB_APP_SLUG || 'grip-bounties';
  return `https://github.com/apps/${appSlug}/installations/new?state=${encodeURIComponent(state)}`;
}
