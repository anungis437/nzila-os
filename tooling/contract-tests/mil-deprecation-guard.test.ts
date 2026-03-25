/**
 * MIL Deprecation Guard
 *
 * Enforces that new code does NOT reference legacy billing tables directly.
 * The canonical MIL tables (org_subscriptions, platform_invoices, platform_payments)
 * must be used via the platform-economics service layer instead.
 *
 * @contract MIL-DEP-001, MIL-DEP-002
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const UE = join(ROOT, 'apps', 'union-eyes');

function collectFiles(dir: string, exts = ['.ts', '.tsx']): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      files.push(...collectFiles(full, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      files.push(full);
    }
  }
  return files;
}

// Legacy billing tables that should not be referenced in app code
const LEGACY_BILLING_TABLES = [
  'billing_subscriptions',
  'billing_invoices',
  'billing_payments',
];

// Paths allowed to reference legacy tables (migrations, seeds, schema definitions)
const ALLOWLIST_PATTERNS = [
  /db[/\\]migrations/,
  /db[/\\]schema/,
  /seed/i,
  /fixtures/,
  /contract-tests/,
  /staging-certification/,
  /__tests__/,
  /\.test\./,
  /\.spec\./,
  /\.cert\./,
];

// ============================================================================
// MIL-DEP-001 — No legacy billing table references in app/action code
// ============================================================================

describe('MIL-DEP-001 — No legacy billing table refs in app code', () => {
  const appFiles = collectFiles(join(UE, 'app'));
  const actionFiles = collectFiles(join(UE, 'actions'));
  const allFiles = [...appFiles, ...actionFiles];

  const violations: string[] = [];

  for (const file of allFiles) {
    const relPath = relative(ROOT, file);
    if (ALLOWLIST_PATTERNS.some((p) => p.test(relPath))) continue;

    const content = readFileSync(file, 'utf-8');
    for (const table of LEGACY_BILLING_TABLES) {
      if (content.includes(table)) {
        violations.push(`${relPath}: references '${table}'`);
      }
    }
  }

  it('no app/action files reference legacy billing tables', () => {
    expect(violations).toEqual([]);
  });
});

// ============================================================================
// MIL-DEP-002 — Dashboard pages do not use raw db.execute on billing tables
// ============================================================================

describe('MIL-DEP-002 — Dashboard pages use MIL services, not raw SQL', () => {
  const dashboardDir = join(UE, 'app', '[locale]', 'dashboard');
  const pages = collectFiles(dashboardDir).filter((f) => f.endsWith('page.tsx'));

  const violations: string[] = [];

  for (const page of pages) {
    const relPath = relative(ROOT, page);
    const content = readFileSync(page, 'utf-8');

    for (const table of LEGACY_BILLING_TABLES) {
      if (content.includes(table)) {
        violations.push(`${relPath}: raw SQL on '${table}'`);
      }
    }
  }

  it('no dashboard pages reference legacy billing tables', () => {
    expect(violations).toEqual([]);
  });
});
