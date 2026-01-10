import { test as teardown } from '@playwright/test';
import { eq } from 'drizzle-orm';

// Load environment variables from .env.development.local
import dotenv from 'dotenv';
dotenv.config({ path: '.env.development.local' });

import { db, user, session, passkey, accessKey, activityLog, account } from './db';
import { TEST_USERS } from './fixtures';

/**
 * Global teardown for E2E tests
 *
 * Cleans up all browser-specific test users and related data.
 * Order matters due to foreign key constraints.
 */
teardown('cleanup auth and db', async () => {
  const userIds = Object.values(TEST_USERS).map((u) => u.id);

  for (const userId of userIds) {
    // Delete in order of FK dependencies (children first)
    await db.delete(accessKey).where(eq(accessKey.userId, userId));
    await db.delete(activityLog).where(eq(activityLog.userId, userId));
    await db.delete(passkey).where(eq(passkey.userId, userId));
    await db.delete(account).where(eq(account.userId, userId));
    await db.delete(session).where(eq(session.userId, userId));

    // Delete test user last
    await db.delete(user).where(eq(user.id, userId));
  }

  console.log('E2E teardown complete: test user and session deleted');
});
