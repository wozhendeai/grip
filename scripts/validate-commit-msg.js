#!/usr/bin/env node

/**
 * validate-commit-msg.js
 *
 * Enforces Conventional Commits format for commit messages.
 *
 * Required format: <type>(<scope>): <subject>
 *
 * Why Conventional Commits:
 * - Enables automated changelog generation
 * - Supports semantic versioning automation
 * - Makes git log easier to read and understand
 * - Allows filtering commits by type (git log --grep="^feat")
 * - Industry standard used by Angular, React, Vue, and many others
 *
 * Trade-offs:
 * - Adds friction to commits (must follow format)
 * - Rejected commits frustrate developers initially
 * - Long-term benefits outweigh short-term friction
 * - Team coordination and changelog automation worth the discipline
 *
 * Resources:
 * - Specification: https://www.conventionalcommits.org
 * - Examples: https://www.conventionalcommits.org/en/v1.0.0/#examples
 */

const fs = require('node:fs');

// Allowed commit types based on Conventional Commits spec
// Each type has a specific purpose in the development workflow
const TYPES = [
  'feat', // New feature for the user (not a new feature for build script)
  'fix', // Bug fix for the user (not a fix to a build script)
  'docs', // Documentation only changes
  'style', // Formatting, missing semicolons, etc; no code change
  'refactor', // Refactoring production code (neither fixes a bug nor adds a feature)
  'perf', // Performance improvements
  'test', // Adding missing tests or correcting existing tests
  'chore', // Changes to build process, auxiliary tools, libraries
  'ci', // Changes to CI/CD configuration files and scripts
  'build', // Changes that affect the build system or external dependencies
  'revert', // Reverts a previous commit
];

// Conventional Commits regex pattern
// Format: type(scope): subject
// - type: required (from TYPES list above)
// - scope: optional (e.g., "auth", "db", "api")
// - subject: required (1-100 characters)
//
// Examples that match:
// - "feat(auth): add passkey registration"
// - "fix: correct migration file"
// - "docs(readme): update installation steps"
//
// Examples that don't match:
// - "added new feature" (no type)
// - "feat add feature" (missing colon)
// - "feat(): missing subject" (empty subject)
const PATTERN =
  /^(feat|fix|docs|style|refactor|perf|test|chore|ci|build|revert)(\(.+\))?: .{1,100}/;

// Special cases to allow (Git-generated messages)
// These bypass validation because they're not user-written commits
const ALLOWED_PATTERNS = [
  /^Merge pull request #\d+/, // GitHub PR merge
  /^Merge branch/, // Branch merge
  /^Revert "/, // Git revert command
  /^Initial commit/, // Repository initialization
  /^Merge remote-tracking branch/, // Git pull merge
];

/**
 * Validates a commit message against Conventional Commits format
 *
 * @param {string} commitMsgFile - Path to git commit message file
 * @returns {boolean} - True if valid, false otherwise
 */
function validateCommitMessage(commitMsgFile) {
  try {
    // Read commit message from file
    // Git passes the commit message file path as an argument
    const commitMsg = fs.readFileSync(commitMsgFile, 'utf8').trim();

    // Empty commit message (shouldn't happen, but handle gracefully)
    if (!commitMsg) {
      console.error('\n❌ Empty commit message!\n');
      console.error('Commit message cannot be empty.');
      console.error('Please provide a meaningful commit message.\n');
      return false;
    }

    // Check if it's a special case (merge, revert, etc.)
    // These are Git-generated and should bypass validation
    if (ALLOWED_PATTERNS.some((pattern) => pattern.test(commitMsg))) {
      console.log('✅ Special commit type detected - validation skipped');
      return true;
    }

    // Validate against Conventional Commits format
    if (!PATTERN.test(commitMsg)) {
      console.error('\n❌ Invalid commit message format!\n');
      console.error(`Your message:\n  "${commitMsg}"\n`);
      console.error('Required format: <type>(<scope>): <subject>\n');
      console.error(`Allowed types: ${TYPES.join(', ')}\n`);
      console.error('Scope is optional but recommended.\n');
      console.error('✅ Valid examples:');
      console.error('  feat(auth): add passkey registration flow');
      console.error('  fix(bounties): correct payout calculation');
      console.error('  docs: update API documentation');
      console.error('  refactor(db): simplify query builder');
      console.error('  test(api): add integration tests\n');
      console.error('❌ Invalid examples:');
      console.error('  added new feature');
      console.error('  fix bug');
      console.error('  WIP');
      console.error('  feat(): missing subject');
      console.error('  feat add feature (missing colon)\n');
      console.error('Learn more: https://www.conventionalcommits.org\n');
      return false;
    }

    // Success! Message follows Conventional Commits format
    console.log('✅ Commit message follows Conventional Commits format');
    return true;
  } catch (error) {
    // Unexpected error reading commit message file
    console.error('\n❌ Error reading commit message:\n');
    console.error(error.message);
    console.error('\nThis is likely a bug in the hook.');
    console.error('To bypass: git commit --no-verify\n');
    return false;
  }
}

// Main execution
// Git passes the commit message file path as the first argument
const commitMsgFile = process.argv[2];

if (!commitMsgFile) {
  console.error('❌ ERROR: Commit message file path not provided');
  console.error('Usage: validate-commit-msg.js <commit-msg-file>');
  console.error('This script should be called by git via lefthook.');
  process.exit(1);
}

// Validate and exit with appropriate code
// Exit code 0 = success (allow commit)
// Exit code 1 = failure (reject commit)
const isValid = validateCommitMessage(commitMsgFile);
process.exit(isValid ? 0 : 1);
