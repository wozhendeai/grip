import { test as setup } from '@playwright/test';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

// Load environment variables from .env.development.local
import dotenv from 'dotenv';
dotenv.config({ path: '.env.development.local' });

import { db, user, session } from './db';
import { TEST_USER } from './fixtures';

/**
 * Global setup for E2E tests
 *
 * Creates a test user and session directly in the database,
 * then saves the auth state to .auth/auth.json for reuse.
 */
setup('setup auth and db', async () => {
  const now = new Date();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Sign the session token
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error('BETTER_AUTH_SECRET not set');
  }

  const signature = crypto
    .createHmac('sha256', secret)
    .update(TEST_USER.sessionToken)
    .digest('base64');
  const signedToken = `${TEST_USER.sessionToken}.${signature}`;

  // Upsert test user
  const existingUser = await db.select().from(user).where(eq(user.id, TEST_USER.id)).limit(1);

  if (existingUser.length === 0) {
    await db.insert(user).values({
      id: TEST_USER.id,
      name: TEST_USER.name,
      email: TEST_USER.email,
      emailVerified: true,
      githubUserId: BigInt(TEST_USER.githubUserId),
      createdAt: now,
      updatedAt: now,
    });
  }

  // Delete existing sessions for this user
  await db.delete(session).where(eq(session.userId, TEST_USER.id));

  // Create new session
  await db.insert(session).values({
    id: `session-${TEST_USER.id}`,
    token: TEST_USER.sessionToken,
    userId: TEST_USER.id,
    expiresAt,
    createdAt: now,
    updatedAt: now,
  });

  // Ensure .auth directory exists
  const authDir = path.join(process.cwd(), '.auth');
  await fs.mkdir(authDir, { recursive: true });

  // Write auth state file
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  const url = new URL(baseUrl);

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

  await fs.writeFile(path.join(authDir, 'auth.json'), JSON.stringify(authState, null, 2));

  console.log('E2E setup complete: test user and session created');
});
