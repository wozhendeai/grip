/**
 * GitHub App Utilities
 *
 * Claim state signing and GitHub App URL builders.
 * JWT generation and token caching are handled by Octokit internally.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { installationOctokit } from './index';

// ============ Types ============

export interface ClaimState {
  userId: string;
  owner: string;
  repo: string;
  timestamp: number;
  callbackUrl?: string;
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

// ============ Installation Repos ============

/**
 * Get all repositories accessible to a GitHub App installation
 *
 * Octokit handles JWT generation and token caching internally.
 */
export async function getInstallationRepos(
  installationId: string | bigint
): Promise<InstallationRepo[]> {
  const octokit = installationOctokit(installationId);

  const repos = await octokit.paginate(octokit.apps.listReposAccessibleToInstallation, {
    per_page: 100,
  });

  return repos as InstallationRepo[];
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

// ============ URL Builders ============

function getAppSlug(): string {
  const appSlug = process.env.GITHUB_APP_SLUG;
  if (!appSlug) {
    throw new Error('Missing GITHUB_APP_SLUG environment variable');
  }
  return appSlug;
}

/**
 * Build the GitHub App installation URL for a specific repository
 */
export function getInstallUrl(owner: string, _repo: string, state: string): string {
  const encodedState = encodeURIComponent(state);
  return `https://github.com/apps/${getAppSlug()}/installations/new/permissions?suggested_target_id=${owner}&repository_ids=&state=${encodedState}`;
}

/**
 * Build the simple GitHub App installation URL
 */
export function getSimpleInstallUrl(state: string): string {
  return `https://github.com/apps/${getAppSlug()}/installations/new?state=${encodeURIComponent(state)}`;
}
