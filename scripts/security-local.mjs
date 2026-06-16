#!/usr/bin/env node

/**
 * GAS Template — Local Security Check
 *
 * Mirrors the CI security workflow locally.
 * - npm audit + license-checker always run (fast, no extra install needed)
 * - semgrep + gitleaks run only if installed; skipped with install hint if missing
 *
 * Usage: node scripts/security-local.mjs
 *        npm run security
 */

import { execSync, spawnSync } from 'node:child_process';

let anyFailed = false;

function isAvailable(cmd) {
  const result = spawnSync(cmd, ['--version'], { stdio: 'ignore' });
  return result.status === 0 && result.error === undefined;
}

function run(cmd, label) {
  console.log(`\n▸ ${label}...`);
  try {
    execSync(cmd, { stdio: 'inherit' });
    console.log(`  ✓ ${label} passed`);
    return true;
  } catch {
    console.error(`  ✗ ${label} failed`);
    anyFailed = true;
    return false;
  }
}

function skip(label, hint) {
  console.log(`\n▸ ${label}...`);
  console.log(`  — skipped: ${label} not installed locally`);
  console.log(`    install hint: ${hint}`);
}

console.log('\n━━━ GAS Security Check ━━━\n');

// Always run: npm audit
run('npm audit --audit-level=high', 'npm audit');

// Always run: license-checker
run(
  "npx license-checker --production --failOn 'GPL;AGPL;LGPL;CC-BY-SA'",
  'license-checker',
);

// Optional: semgrep
if (isAvailable('semgrep')) {
  run(
    'semgrep scan --config p/typescript --config p/react --config p/owasp-top-ten .',
    'semgrep',
  );
} else {
  skip('semgrep', 'pipx install semgrep  (or: pip install semgrep)');
}

// Optional: gitleaks
if (isAvailable('gitleaks')) {
  run('gitleaks detect --config .gitleaks.toml --source . --no-banner', 'gitleaks');
} else {
  skip('gitleaks', 'brew install gitleaks  (or: https://github.com/gitleaks/gitleaks#getting-started)');
}

// Final result
if (anyFailed) {
  console.error('\n⛔ Security check failed — see errors above.\n');
  process.exit(1);
} else {
  console.log('\n✅ All available security checks passed.\n');
}
