import { test as base, type BrowserContext, type CDPSession, type Page } from '@playwright/test';
import { eq, and } from 'drizzle-orm';
import crypto from 'node:crypto';

import { db, repoSettings } from './db';

/**
 * E2E Test Fixtures
 *
 * Consolidated fixtures for Playwright tests with direct DB access.
 * Uses global.setup.ts for test user/session seeding.
 */

// Test user constants - matches what global.setup.ts creates
export const TEST_USER = {
  id: 'test-user-e2e',
  name: 'Test User',
  email: 'test-e2e@example.com',
  githubUserId: '999999999',
  sessionToken: '00000000000000000000000000000000',
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
}

export const test = base.extend<TestFixtures>({
  // Static test user from global.setup.ts
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires object destructuring
  testUser: async ({}, use) => {
    await use({
      id: TEST_USER.id,
      name: TEST_USER.name,
      email: TEST_USER.email,
      githubUserId: TEST_USER.githubUserId,
    });
  },

  // Browser context with auth cookie (from storageState set in playwright.config.ts)
  authenticatedContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: '.auth/auth.json',
    });
    await use(context);
    await context.close();
  },

  authenticatedPage: async ({ authenticatedContext }, use) => {
    const page = await authenticatedContext.newPage();
    await use(page);
  },

  // Seed a claimed repo directly in DB (use real GitHub repos)
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires object destructuring
  seedClaimedRepo: async ({}, use) => {
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

    // Create CDP session for WebAuthn control
    const client = await page.context().newCDPSession(page);

    await client.send('WebAuthn.enable');

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

    await use({ authenticatorId, cdpSession: client });

    // Cleanup
    try {
      await client.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
      await client.send('WebAuthn.disable');
    } catch {
      // Page/context already closed
    }
  },
});

export { expect } from '@playwright/test';
