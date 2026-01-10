import { test as base, type BrowserContext, type CDPSession, type Page } from '@playwright/test';
import { eq, and } from 'drizzle-orm';
import crypto from 'node:crypto';

import { db, repoSettings, passkey, accessKey } from './db';

/**
 * E2E Test Fixtures
 *
 * Consolidated fixtures for Playwright tests with direct DB access.
 * Uses global.setup.ts for test user/session seeding.
 */

// Test user constants - browser-specific to allow parallel execution
// Each browser gets its own user to prevent database conflicts
export const TEST_USERS = {
  chromium: {
    id: 'test-user-e2e-chromium',
    name: 'Test User',
    email: 'test-e2e-chromium@example.com',
    githubUserId: '999999991',
    sessionToken: '00000000000000000000000000000001',
  },
  firefox: {
    id: 'test-user-e2e-firefox',
    name: 'Test User',
    email: 'test-e2e-firefox@example.com',
    githubUserId: '999999992',
    sessionToken: '00000000000000000000000000000002',
  },
} as const;

// Sign a session token using BETTER_AUTH_SECRET
export function signSessionToken(token: string): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error('BETTER_AUTH_SECRET not set');
  }
  const signature = crypto.createHmac('sha256', secret).update(token).digest('base64');
  return `${token}.${signature}`;
}

// Types
export interface TestUser {
  id: string;
  name: string;
  email: string;
  githubUserId: string;
}

export interface SeededRepo {
  githubRepoId: string;
  owner: string;
  repo: string;
}

export interface VirtualAuthenticator {
  authenticatorId: string;
  cdpSession: CDPSession;
}

export interface TestFixtures {
  testUser: TestUser;
  authenticatedContext: BrowserContext;
  authenticatedPage: Page;
  seedClaimedRepo: (params: {
    owner: string;
    repo: string;
    userId: string;
    onboardingCompleted?: boolean;
  }) => Promise<SeededRepo>;
  virtualAuthenticator: VirtualAuthenticator | null;
  cleanUserWallet: () => Promise<void>;
}

export const test = base.extend<TestFixtures>({
  // Browser-specific test user from global.setup.ts
  testUser: async ({ browserName }, use) => {
    const userData = TEST_USERS[browserName as keyof typeof TEST_USERS] || TEST_USERS.chromium;
    await use({
      id: userData.id,
      name: userData.name,
      email: userData.email,
      githubUserId: userData.githubUserId,
    });
  },

  // Browser context with auth cookie - uses browser-specific auth file
  authenticatedContext: async ({ browser, browserName }, use) => {
    const authFile = browserName === 'firefox' ? '.auth/auth-firefox.json' : '.auth/auth.json';
    const context = await browser.newContext({
      storageState: authFile,
    });
    await use(context);
    await context.close();
  },

  authenticatedPage: async ({ authenticatedContext }, use) => {
    const page = await authenticatedContext.newPage();
    await use(page);
  },

  // Seed a claimed repo directly in DB (use real GitHub repos)
  seedClaimedRepo: async ({ browserName: _browserName }, use) => {
    const seededRepos: SeededRepo[] = [];

    const seedFn = async (params: {
      owner: string;
      repo: string;
      userId: string;
      onboardingCompleted?: boolean;
    }): Promise<SeededRepo> => {
      const githubRepoId = BigInt(Date.now());

      // Delete existing repo with same owner/repo name
      await db
        .delete(repoSettings)
        .where(
          and(eq(repoSettings.githubOwner, params.owner), eq(repoSettings.githubRepo, params.repo))
        );

      // Create new repo_settings record
      await db.insert(repoSettings).values({
        githubRepoId,
        githubOwner: params.owner,
        githubRepo: params.repo,
        verifiedOwnerUserId: params.userId,
        verifiedAt: new Date().toISOString(),
        installationId: BigInt(Date.now() + 1),
        onboardingCompleted: params.onboardingCompleted ?? false,
      });

      const seededRepo: SeededRepo = {
        githubRepoId: githubRepoId.toString(),
        owner: params.owner,
        repo: params.repo,
      };
      seededRepos.push(seededRepo);
      return seededRepo;
    };

    await use(seedFn);

    // Cleanup all seeded repos
    for (const repo of seededRepos) {
      try {
        await db
          .delete(repoSettings)
          .where(eq(repoSettings.githubRepoId, BigInt(repo.githubRepoId)));
      } catch (err) {
        console.warn(`Failed to cleanup repo ${repo.githubRepoId}:`, err);
      }
    }
  },

  // Clean up test user's wallet/passkey data for tests that need fresh state
  cleanUserWallet: async ({ browserName }, use) => {
    const userData = TEST_USERS[browserName as keyof typeof TEST_USERS] || TEST_USERS.chromium;
    const cleanFn = async () => {
      await db.delete(accessKey).where(eq(accessKey.userId, userData.id));
      await db.delete(passkey).where(eq(passkey.userId, userData.id));
    };
    await use(cleanFn);
  },

  // WebAuthn virtual authenticator (Chromium only)
  virtualAuthenticator: async ({ browserName, authenticatedPage }, use) => {
    if (browserName !== 'chromium') {
      console.warn('WebAuthn virtual authenticator only supported in Chromium');
      await use(null);
      return;
    }

    const page = authenticatedPage;
    if (!page) {
      console.warn('No authenticatedPage available for WebAuthn');
      await use(null);
      return;
    }

    console.log('[virtualAuthenticator] Creating CDP session for WebAuthn');

    // Create CDP session for WebAuthn control
    const client = await page.context().newCDPSession(page);

    await client.send('WebAuthn.enable');
    console.log('[virtualAuthenticator] WebAuthn.enable sent');

    const { authenticatorId } = await client.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    });
    console.log('[virtualAuthenticator] Virtual authenticator created:', authenticatorId);

    await use({ authenticatorId, cdpSession: client });

    // Cleanup
    console.log('[virtualAuthenticator] Cleaning up authenticator:', authenticatorId);
    try {
      await client.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
      await client.send('WebAuthn.disable');
      console.log('[virtualAuthenticator] Cleanup complete');
    } catch (err) {
      console.log('[virtualAuthenticator] Cleanup skipped (page/context closed)');
    }
  },
});

export { expect } from '@playwright/test';
