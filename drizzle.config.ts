import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Load production env for migrations (default), or use DOTENV_CONFIG_PATH
config({ path: process.env.DOTENV_CONFIG_PATH || '.env.production.local' });

export default defineConfig({
  schema: './db/schema/*.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
