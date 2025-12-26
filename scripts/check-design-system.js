#!/usr/bin/env node

/**
 * check-design-system.js
 *
 * Prevents hardcoded CSS values and enforces design system usage.
 *
 * Checks:
 * 1. Colors - Tailwind default palette, hex, rgb (should use semantic tokens)
 * 2. Spacing - Arbitrary px values (should use Tailwind spacing scale)
 * 3. Font sizes - Arbitrary px values (should use semantic text utilities)
 * 4. Border radius - Arbitrary px values (should use radius tokens)
 *
 * Why this matters:
 * - Enforces consistent design system
 * - Prevents style drift and inconsistency
 * - Makes theme switching and dark mode reliable
 * - Ensures responsive design follows system constraints
 *
 * Trade-offs:
 * - Adds ~300ms to pre-commit (more patterns to check)
 * - Prevents accidental hardcoded values
 * - Maintains design system integrity
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

// Pattern definitions for each violation type
const DESIGN_SYSTEM_VIOLATIONS = {
  colors: {
    pattern:
      /\b(bg|text|border|ring|divide|outline|shadow|from|via|to|decoration|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+/g,
    message: 'Use semantic color tokens (primary, destructive, etc.)',
    example: 'bg-primary/10',
  },
  hexColors: {
    pattern: /#(?:[0-9a-fA-F]{3}){1,2}\b/g,
    message: 'Use semantic color tokens instead of hex colors',
    example: 'text-primary',
  },
  rgbColors: {
    pattern: /rgba?\([^)]+\)/g,
    message: 'Use semantic color tokens instead of rgb/rgba',
    example: 'bg-primary',
  },
  spacing: {
    pattern:
      /\b(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-x|space-y|inset|top|right|bottom|left)-\[\d+px\]/g,
    message: 'Use Tailwind spacing scale instead of arbitrary px values',
    example: 'p-6',
  },
  fontSize: {
    pattern: /\btext-\[\d+px\]/g,
    message: 'Use semantic text utilities (text-xs, text-sm, body-sm, etc.)',
    example: 'text-sm',
  },
  borderRadius: {
    pattern: /\brounded(?:-[tlbr]{1,2})?-\[\d+px\]/g,
    message: 'Use design system radius tokens (rounded-md, rounded-lg, etc.)',
    example: 'rounded-md',
  },
};

// Files to exclude from checking
const EXCLUDED_PATTERNS = ['node_modules/', 'app/globals.css', 'components/ui/', 'scripts/'];

function isExcludedFile(filePath) {
  return EXCLUDED_PATTERNS.some((pattern) => filePath.includes(pattern));
}

// Get all TypeScript/JavaScript files to check
function getFilesToCheck() {
  try {
    // Get all staged files if in git hook context, otherwise check all files
    let files = [];
    let inGitContext = false;

    try {
      const stagedFiles = execSync('git diff --cached --name-only --diff-filter=ACMR', {
        encoding: 'utf8',
      })
        .trim()
        .split('\n')
        .filter(Boolean);

      if (stagedFiles.length > 0 && stagedFiles[0] !== '') {
        inGitContext = true;
        files = stagedFiles.filter(
          (file) => file.match(/\.(tsx?|jsx?)$/) && !isExcludedFile(file) && fs.existsSync(file)
        );
      }
    } catch {
      // Not in a git context
      inGitContext = false;
    }

    // Only check all files if we're NOT in a git context
    // If we are in git context but files is empty, it means all staged files were excluded
    if (!inGitContext && files.length === 0) {
      const allFiles = execSync(
        'find . -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \\) -not -path "*/node_modules/*" -not -path "*/.next/*" -not -path "*/.git/*"',
        { encoding: 'utf8' }
      )
        .trim()
        .split('\n')
        .filter(Boolean);

      files = allFiles
        .filter((file) => !isExcludedFile(file))
        .map((file) => file.replace(/^\.\//, ''));
    }

    return files;
  } catch (error) {
    console.error('Error getting files to check:', error.message);
    return [];
  }
}

// Generate a specific suggested fix for a violation
function getSuggestedFix(match, violationType) {
  if (violationType === 'colors') {
    // Map common colors to semantic tokens
    if (match.includes('blue')) return match.replace(/blue-\d+/, 'primary');
    if (match.includes('red')) return match.replace(/red-\d+/, 'destructive');
    if (match.includes('green')) return match.replace(/green-\d+/, 'success');
    if (match.includes('yellow') || match.includes('amber'))
      return match.replace(/(yellow|amber)-\d+/, 'chart-4');
    if (match.includes('gray') || match.includes('zinc') || match.includes('slate'))
      return match.replace(/(gray|zinc|slate)-\d+/, 'muted');
    return 'primary';
  }

  if (violationType === 'spacing') {
    const prefix = match.split('-')[0]; // p, m, px, etc.
    return `${prefix}-4`;
  }

  if (violationType === 'fontSize') {
    return 'text-sm';
  }

  if (violationType === 'borderRadius') {
    return 'rounded-md';
  }

  return 'Use design system token';
}

// Check a single file for violations
function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const violations = [];

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];

    // Skip comments
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
      continue;
    }

    // Check for each violation type
    for (const [violationType, config] of Object.entries(DESIGN_SYSTEM_VIOLATIONS)) {
      const matches = line.matchAll(config.pattern);

      for (const match of matches) {
        const suggestedFix = getSuggestedFix(match[0], violationType);
        const fixedLine = line.replace(match[0], suggestedFix);

        violations.push({
          file: filePath,
          line: lineNum + 1,
          lineContent: line.trim(),
          type: violationType,
          match: match[0],
          suggestedFix,
          fixedLine: fixedLine.trim(),
          message: config.message,
          example: config.example,
        });
      }
    }
  }

  return violations;
}

// Group violations by file for cleaner output
function groupViolationsByFile(violations) {
  const grouped = {};

  for (const violation of violations) {
    if (!grouped[violation.file]) {
      grouped[violation.file] = [];
    }
    grouped[violation.file].push(violation);
  }

  return grouped;
}

// Format and print violations
function printViolations(violations) {
  const grouped = groupViolationsByFile(violations);
  const fileCount = Object.keys(grouped).length;

  // Summary at top
  console.error('\n\x1b[31m❌ Design system violations found!\x1b[0m');
  console.error(`\x1b[33m${violations.length} violation(s) in ${fileCount} file(s)\x1b[0m\n`);

  // Show violations grouped by file
  for (const [file, fileViolations] of Object.entries(grouped)) {
    console.error(`\x1b[1m${file}\x1b[0m (${fileViolations.length} violation(s))`);

    for (const violation of fileViolations) {
      // Show line number and violation type
      console.error(`\n  \x1b[2mLine ${violation.line}:\x1b[0m ${violation.message}`);

      // Show the actual code with violation highlighted
      const linePreview =
        violation.lineContent.length > 100
          ? `${violation.lineContent.substring(0, 100)}...`
          : violation.lineContent;
      console.error(`  \x1b[31m  - ${linePreview}\x1b[0m`);

      // Show specific fix
      console.error(
        `  \x1b[32m  + ${violation.match}\x1b[0m → \x1b[32m${violation.suggestedFix}\x1b[0m`
      );
    }
    console.error('');
  }

  // Quick reference at bottom
  console.error('\x1b[1m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
  console.error('\x1b[1mQuick Reference - Available Design Tokens:\x1b[0m');
  console.error('  \x1b[36mColors:\x1b[0m primary, secondary, destructive, muted, accent, success');
  console.error('  \x1b[36mSpacing:\x1b[0m 0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, etc.');
  console.error('  \x1b[36mText:\x1b[0m text-xs, text-sm, text-base, text-lg');
  console.error('  \x1b[36mRadius:\x1b[0m rounded-sm, rounded-md, rounded-lg, rounded-xl\n');
}

// Main execution
function main() {
  const files = getFilesToCheck();

  if (files.length === 0) {
    console.log('No files to check.');
    process.exit(0);
  }

  console.log(`Checking ${files.length} file(s) for design system violations...`);

  const allViolations = [];

  for (const file of files) {
    const violations = checkFile(file);
    allViolations.push(...violations);
  }

  if (allViolations.length > 0) {
    printViolations(allViolations);
    process.exit(1);
  }

  console.log('✅ No design system violations found!');
  process.exit(0);
}

main();
