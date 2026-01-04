import { test as setup } from '@playwright/test';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

// Load environment variables from .env.development.local
import dotenv from 'dotenv';
dotenv.config({ path: '.env.development.local' });

import { db, user, session } from './db';
import { TEST_USERS } from './fixtures';

/**
 * Global setup for E2E tests
 *
 * Creates browser-specific test users and sessions directly in the database,
 * then saves the auth state to .auth/auth.json and .auth/auth-firefox.json.
 */
setup('setup auth and db', async () => {
  const now = new Date();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error('BETTER_AUTH_SECRET not set');
  }

  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  const url = new URL(baseUrl);

  // Ensure .auth directory exists
  const authDir = path.join(process.cwd(), '.auth');
  await fs.mkdir(authDir, { recursive: true });

  // Create users for each browser
  const browsers = [
    { name: 'chromium', user: TEST_USERS.chromium, authFile: 'auth.json' },
    { name: 'firefox', user: TEST_USERS.firefox, authFile: 'auth-firefox.json' },
  ];

  for (const browser of browsers) {
    const testUser = browser.user;

    // Sign the session token
    const signature = crypto
      .createHmac('sha256', secret)
      .update(testUser.sessionToken)
      .digest('base64');
    const signedToken = `${testUser.sessionToken}.${signature}`;

    // Upsert test user
    const existingUser = await db.select().from(user).where(eq(user.id, testUser.id)).limit(1);

    if (existingUser.length === 0) {
      await db.insert(user).values({
        id: testUser.id,
        name: testUser.name,
        email: testUser.email,
        emailVerified: true,
        githubUserId: BigInt(testUser.githubUserId),
        createdAt: now,
        updatedAt: now,
      });
    }

    // Delete existing sessions for this user
    await db.delete(session).where(eq(session.userId, testUser.id));

    // Create new session
    await db.insert(session).values({
      id: `session-${testUser.id}`,
      token: testUser.sessionToken,
      userId: testUser.id,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });

    // Write auth state file
    const authState = {
      cookies: [
        {
          name: 'better-auth.session_token',
          value: encodeURIComponent(signedToken),
          domain: url.hostname,
          path: '/',
          httpOnly: true,
          secure: url.protocol === 'https:',
          sameSite: 'Lax' as const,
          expires: Math.round(expiresAt.getTime() / 1000),
        },
      ],
      origins: [],
    };

    await fs.writeFile(path.join(authDir, browser.authFile), JSON.stringify(authState, null, 2));
  }

  console.log('E2E setup complete: test user and session created');
});
