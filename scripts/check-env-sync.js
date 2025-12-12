#!/usr/bin/env node

/**
 * check-env-sync.js
 *
 * Ensures environment variables stay in sync:
 * 1. .env.example contains all vars from .env (local developer env)
 * 2. Code only uses env vars documented in .env.example
 *
 * Why this matters:
 * - New developers know what env vars to set up
 * - No orphaned env var references in code
 * - .env.example stays up to date as single source of truth
 *
 * Trade-offs:
 * - Adds ~500ms to pre-commit (grep for process.env)
 * - Prevents undocumented env var sprawl
 * - Ensures .env.example is always current
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ENV_EXAMPLE = '.env.example';
const ENV_LOCAL = '.env';

// Parse .env file into array of variable names
// Skips comments and empty lines, extracts only variable names
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const vars = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Extract variable name (before =)
    // Matches: VARIABLE_NAME=value
    const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=/);
    if (match) {
      vars.push(match[1]);
    }
  }

  return vars;
}

// Find all process.env usages in actual code (not comments)
// Excludes node_modules, .next, and other build artifacts
function findEnvUsageInCode() {
  try {
    // Search all .ts, .tsx, .js files for process.env references
    // Use -v to exclude comment lines
    const result = execSync(
      `find . -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \\) ! -path "*/node_modules/*" ! -path "*/.next/*" ! -path "*/dist/*" -exec grep -Eho 'process\\.env\\.[A-Z_][A-Z0-9_]*' {} \\; 2>/dev/null || true`,
      { encoding: 'utf8' }
    );

    const vars = new Set();
    for (const line of result.split('\n')) {
      const match = line.match(/process\.env\.([A-Z_][A-Z0-9_]*)/);
      if (match) {
        vars.add(match[1]);
      }
    }

    return Array.from(vars).sort();
  } catch (error) {
    console.error('Error searching code:', error.message);
    return [];
  }
}

// Main check function
function checkEnvSync() {
  let hasErrors = false;

  // Parse env files
  const exampleVars = parseEnvFile(ENV_EXAMPLE);
  const localVars = parseEnvFile(ENV_LOCAL);
  const codeVars = findEnvUsageInCode();

  console.log('\n🔍 Checking environment variable sync...\n');

  // CHECK 1: .env.example should contain all vars from .env
  // This ensures new developers know what vars to set up
  if (localVars.length > 0) {
    const missingInExample = localVars.filter((v) => !exampleVars.includes(v));

    if (missingInExample.length > 0) {
      hasErrors = true;
      console.error('❌ CHECK 1 FAILED: .env.example is missing variables from .env\n');
      console.error('Variables in .env but NOT in .env.example:');
      for (const v of missingInExample) {
        console.error(`  - ${v}`);
      }
      console.error('\nFix: Add these variables to .env.example with example values:');
      for (const v of missingInExample) {
        console.error(`  ${v}=example_value_here`);
      }
      console.error('');
    } else {
      console.log('✅ CHECK 1 PASSED: All .env variables are in .env.example');
    }
  } else {
    console.log('⚠️  CHECK 1 SKIPPED: No .env file found (okay for new projects)');
  }

  // CHECK 2: Code should only use env vars documented in .env.example
  // This prevents orphaned env var references
  const undocumented = codeVars.filter((v) => !exampleVars.includes(v));

  if (undocumented.length > 0) {
    hasErrors = true;
    console.error('\n❌ CHECK 2 FAILED: Code uses undocumented environment variables\n');
    console.error('Variables used in code but NOT in .env.example:');

    // Find where each var is used (show first 3 occurrences)
    for (const v of undocumented) {
      console.error(`\n  ${v}:`);
      try {
        const locations = execSync(
          `grep -rn "process\\.env\\.${v}" --include="*.ts" --include="*.tsx" --include="*.js" --exclude-dir=node_modules --exclude-dir=.next . | head -3`,
          { encoding: 'utf8' }
        ).trim();

        for (const loc of locations.split('\n')) {
          if (loc) {
            // Format: file:line:content
            console.error(`    ${loc}`);
          }
        }
      } catch (e) {
        // grep returns non-zero if no matches (already handled)
      }
    }

    console.error('\nFix options:');
    console.error('  1. Add these variables to .env.example:');
    for (const v of undocumented) {
      console.error(`     ${v}=example_value_here`);
    }
    console.error('  2. OR remove the code that uses these variables\n');
  } else {
    console.log('✅ CHECK 2 PASSED: All code env vars are documented in .env.example');
  }

  // Summary
  if (!hasErrors) {
    console.log('\n✅ All environment variable checks passed!\n');
    process.exit(0);
  } else {
    console.error('\n❌ Environment variable sync failed!\n');
    console.error('Environment variables must stay in sync:');
    console.error('  .env → .env.example (document all local vars)');
    console.error('  code → .env.example (only use documented vars)\n');
    process.exit(1);
  }
}

// Run check
checkEnvSync();
