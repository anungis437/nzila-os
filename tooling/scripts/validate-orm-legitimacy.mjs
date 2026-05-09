#!/usr/bin/env node
/**
 * Union Eyes — ORM Governance Legitimacy Validator
 *
 * Static checks that the canonical ORM governance contract is intact.
 * Intended to be runnable in CI and locally:
 *
 *   pnpm --filter @nzila/union-eyes db:validate
 *
 * Per docs/architecture/orm-governance/migration-legitimacy-validation-system.md,
 * this validator asserts:
 *
 *   1. drizzle.config.ts `out` points at the scoped root `db/migrations-cache/`.
 *   2. drizzle.config.ts `schema` points at the scoped barrel
 *      `db/schema-cache/cache.ts`.
 *   3. The scoped barrel exists.
 *   4. The scoped migration root exists with a `meta/_journal.json`.
 *   5. The legacy lineage at `db/migrations/` is FROZEN (sentinel exists,
 *      LINEAGE-FROZEN.md exists).
 *   6. No new SQL files have been added to the legacy lineage since the
 *      freeze (informational warning — uses git if available).
 *   7. The scoped barrel does not import any of the historically broad
 *      schema files (best-effort string scan).
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — one or more checks failed
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const appRoot = path.join(repoRoot, 'apps', 'union-eyes');

const failures = [];
const warnings = [];

function check(name, fn) {
  try {
    const result = fn();
    if (result === true || result === undefined) {
      process.stdout.write(`  ok    ${name}\n`);
    } else {
      failures.push(`${name}: ${result}`);
      process.stdout.write(`  FAIL  ${name} — ${result}\n`);
    }
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
    process.stdout.write(`  FAIL  ${name} — ${err.message}\n`);
  }
}

process.stdout.write('ORM legitimacy validation — Union Eyes\n');

const drizzleConfig = path.join(appRoot, 'drizzle.config.ts');
const drizzleConfigText = fs.existsSync(drizzleConfig)
  ? fs.readFileSync(drizzleConfig, 'utf8')
  : '';

check('drizzle.config.ts exists', () =>
  drizzleConfigText.length > 0 || 'missing',
);

check('drizzle.config out → db/migrations-cache', () => {
  if (!/out:\s*["']\.\/db\/migrations-cache["']/.test(drizzleConfigText)) {
    return 'drizzle.config out is not "./db/migrations-cache"';
  }
});

check('drizzle.config schema → db/schema-cache/cache.ts', () => {
  if (!/schema:\s*["']\.\/db\/schema-cache\/cache\.ts["']/.test(drizzleConfigText)) {
    return 'drizzle.config schema is not "./db/schema-cache/cache.ts"';
  }
});

const scopedBarrel = path.join(appRoot, 'db', 'schema-cache', 'cache.ts');
check('scoped barrel db/schema-cache/cache.ts exists', () =>
  fs.existsSync(scopedBarrel) || 'missing',
);

const scopedRoot = path.join(appRoot, 'db', 'migrations-cache');
const scopedJournal = path.join(scopedRoot, 'meta', '_journal.json');
check('scoped migration root exists', () =>
  fs.existsSync(scopedRoot) || 'missing',
);
check('scoped journal exists', () =>
  fs.existsSync(scopedJournal) || 'missing',
);

const legacyDir = path.join(appRoot, 'db', 'migrations');
const legacySentinel = path.join(legacyDir, '.lineage-frozen');
const legacyDoc = path.join(legacyDir, 'LINEAGE-FROZEN.md');
check('legacy lineage freeze sentinel exists', () =>
  fs.existsSync(legacySentinel) || 'missing — lineage is not formally frozen',
);
check('legacy lineage freeze documentation exists', () =>
  fs.existsSync(legacyDoc) || 'LINEAGE-FROZEN.md missing',
);

check('scoped barrel does not pull broad legacy schema', () => {
  if (!fs.existsSync(scopedBarrel)) return 'barrel missing';
  const text = fs.readFileSync(scopedBarrel, 'utf8');
  // Only inspect actual import/export statements — substring matches in
  // doc comments are not violations.
  const importLines = text
    .split(/\r?\n/)
    .filter((line) => /^\s*(?:import|export)\b[^/]*\bfrom\s+['"]/.test(line));
  const forbidden = [
    'union-structure-standalone',
    'union-structure-schema',
    'schema-organizations',
    'collective-agreements-schema',
    'cba-schema',
    'claims-schema',
    'bargaining-negotiations-schema',
    'grievance',
    'compliance',
  ];
  for (const f of forbidden) {
    for (const line of importLines) {
      if (line.includes(f)) return `imports forbidden module: ${f}`;
    }
  }
});

// Warning-only: detect any new .sql files added under the frozen lineage
// AFTER the freeze date (best-effort timestamp check; not authoritative —
// a CI-side git check is the canonical enforcement, see
// migration-legitimacy-validation-system.md).
try {
  const FREEZE_DATE = new Date('2026-05-09T00:00:00Z');
  const sqlFiles = fs
    .readdirSync(legacyDir)
    .filter((f) => f.endsWith('.sql'));
  for (const f of sqlFiles) {
    const stat = fs.statSync(path.join(legacyDir, f));
    if (stat.mtime > FREEZE_DATE) {
      warnings.push(
        `legacy migration mtime newer than freeze: ${f} (${stat.mtime.toISOString()})`,
      );
    }
  }
} catch {
  // best-effort
}

if (warnings.length > 0) {
  process.stdout.write('\nwarnings:\n');
  for (const w of warnings) process.stdout.write(`  warn  ${w}\n`);
}

if (failures.length > 0) {
  process.stdout.write(
    `\n${failures.length} legitimacy check(s) failed.\n`,
  );
  process.exit(1);
}

process.stdout.write('\nORM legitimacy: OK.\n');
