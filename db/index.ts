import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as authSchema from './schema/auth';
import * as businessSchema from './schema/business';

const connectionString = process.env.DATABASE_URL!;

// Disable prefetch as it's not supported for "Transaction" pool mode
const client = postgres(connectionString, { prepare: false });

// Combine auth and business schemas
const schema = {
  ...authSchema,
  ...businessSchema,
};

export const db = drizzle(client, { schema });

// Re-export schemas for use in queries
export * from './schema/auth';
export * from './schema/business';

// Re-export network utilities
export * from './network';

// Note: Query functions available at @/db/queries
// Not re-exported here to avoid type conflicts with schema exports
