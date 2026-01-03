import { test as teardown } from '@playwright/test';
import { eq } from 'drizzle-orm';

// Load environment variables from .env.development.local
import dotenv from 'dotenv';
dotenv.config({ path: '.env.development.local' });

import { db, user, session } from './db';
import { TEST_USER } from './fixtures';

/**
 * Global teardown for E2E tests
 *
 * Cleans up test user and session from the database.
 */
teardown('cleanup auth and db', async () => {
  // Delete sessions first (foreign key constraint)
  await db.delete(session).where(eq(session.userId, TEST_USER.id));

  // Delete test user
  await db.delete(user).where(eq(user.id, TEST_USER.id));

  console.log('E2E teardown complete: test user and session deleted');
});
