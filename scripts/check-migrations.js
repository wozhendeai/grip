#!/usr/bin/env node

/**
 * check-migrations.js
 *
 * Verifies that when db/schema/ files are modified, corresponding
 * Drizzle migrations have been generated and staged.
 *
 * Why this script exists:
 * - Prevents developers from forgetting to generate migrations after modifying schema
 * - Catches the #1 cause of production deployment failures (uncommitted migrations)
 * - Ensures database schema and code stay in sync
 *
 * How it works:
 * 1. Checks git staging area for db/schema/ changes
 * 2. If schema files are staged, verifies drizzle/ files are also staged
 * 3. Fails commit if schema changed but migrations weren't generated
 *
 * Trade-offs:
 * - Adds ~100ms to pre-commit hook
 * - Requires developers to run 'pnpm db:generate' after schema changes
 * - Prevents critical production bugs, well worth the friction
 */

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const DRIZZLE_DIR = path.join(__dirname, '..', 'drizzle');

try {
  // Check if drizzle/ directory exists
  // If it doesn't exist, migrations have never been generated
  if (!fs.existsSync(DRIZZLE_DIR)) {
    console.error('❌ ERROR: drizzle/ directory not found!');
    console.error('');
    console.error('This means migrations have never been generated.');
    console.error('Run: pnpm db:generate');
    console.error('');
    process.exit(1);
  }

  // Get list of staged files (files about to be committed)
  // Using --cached flag to only check staging area, not working directory
  const stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean);

  // Check if any schema files are staged
  const hasSchemaChanges = stagedFiles.some((file) => file.startsWith('db/schema/'));

  if (!hasSchemaChanges) {
    // No schema changes in this commit, no need to check migrations
    // Exit successfully without printing anything (keep output clean)
    process.exit(0);
  }

  // Schema files were changed - now verify migrations are also staged
  const hasMigrationChanges = stagedFiles.some((file) => file.startsWith('drizzle/'));

  if (!hasMigrationChanges) {
    // CRITICAL ERROR: Schema modified but migrations weren't generated
    console.error('\n❌ Schema files modified but no migrations staged!\n');
    console.error('You modified:');
    for (const file of stagedFiles) {
      if (file.startsWith('db/schema/')) {
        console.error(`  - ${file}`);
      }
    }
    console.error('\nBut no migration files are staged.\n');
    console.error('Database schema and migrations must stay in sync!');
    console.error('\nFix by running:');
    console.error('  1. pnpm db:generate');
    console.error('  2. Review the generated SQL in drizzle/');
    console.error('  3. git add drizzle/');
    console.error('  4. git commit --amend --no-edit\n');
    console.error('Why this matters:');
    console.error('  - Missing migrations cause production deployment failures');
    console.error('  - Other developers need migrations to sync their databases');
    console.error('  - Database schema and code must stay in sync\n');
    process.exit(1);
  }

  // Both schema and migrations are staged - perfect!
  // Print success message to confirm hook ran
  console.log('✅ Schema changes and migrations are both staged');
  process.exit(0);
} catch (error) {
  // Unexpected error (git command failed, file system error, etc.)
  console.error('❌ Migration check failed with unexpected error:');
  console.error(error.message);
  console.error('');
  console.error('This might be a bug in the hook. Please report it.');
  console.error('To bypass this check temporarily: git commit --no-verify');
  console.error('');
  process.exit(1);
}
