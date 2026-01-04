import dotenv from 'dotenv';
dotenv.config({ path: '.env.development.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as authSchema from '../db/schema/auth';
import * as businessSchema from '../db/schema/business';

/**
 * Direct database connection for E2E tests
 *
 * Uses relative imports instead of path aliases since
 * Playwright runs outside of Next.js context.
 */

const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString, { prepare: false });

const schema = { ...authSchema, ...businessSchema };

export const db = drizzle(client, { schema });

// Re-export schema
export * from '../db/schema/auth';
export * from '../db/schema/business';
