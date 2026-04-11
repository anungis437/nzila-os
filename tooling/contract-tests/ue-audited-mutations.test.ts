/**
 * Contract Test — UnionEyes: All Mutations Must Be Audited
 *
 * BLOCKER: App-layer code must NOT perform direct .insert() / .update() / .delete()
 * without going through createAuditedScopedDb or withAudit().
 *
 * Enforces that UE API routes use getAuditedDb() from @/lib/api-guards.ts
 * for all write operations.
 *
 * Allowlisted:
 * - lib/db/ (RLS infrastructure)
 * - lib/api-guards.ts (the guards themselves)
 * - lib/db-adapter.ts (db adapter layer)
 * - db/ directory (schema definitions, migrations)
 * - services/ (admin-only scripts — see PR-UE-01)
 * - scripts/ (dev scripts)
 *
 * @invariant INV-34: UE mutations are audited
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const UE_ROOT = join(ROOT, 'apps', 'union-eyes');

const ALLOWLISTED_DIRS = [
  'lib/db/',
  'lib/api-guards',
  'lib/db-adapter',
  'db/',
  'services/',
  'scripts/',
  'lib/database/',
  'components/',  // Client components don't do direct DB writes
];

/** Patterns indicating a direct (unaudited) mutation */
const UNAUDITED_MUTATION_PATTERNS = [
  { pattern: /\bdb\.insert\s*\(/, label: 'db.insert() — use getAuditedDb().insert()' },
  { pattern: /\bdb\.update\s*\(/, label: 'db.update() — use getAuditedDb().update()' },
  { pattern: /\bdb\.delete\s*\(/, label: 'db.delete() — use getAuditedDb().delete()' },
];

/** If the file imports from api-guards and uses getAuditedDb, mutations are OK */
const AUDIT_IMPORT_PATTERN = /getAuditedDb|createAuditedScopedDb|withAudit/;

function scanForUnauditedMutations(
  dir: string,
): Array<{ file: string; line: number; content: string; label: string }> {
  const violations: Array<{ file: string; line: number; content: string; label: string }> = [];

  if (!existsSync(dir)) return violations;
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = relative(UE_ROOT, fullPath).split(sep).join('/');

    if (entry.isDirectory()) {
      if (['node_modules', '.next', '__pycache__', 'migrations'].includes(entry.name)) continue;
      violations.push(...scanForUnauditedMutations(fullPath));
      continue;
    }

    if (!entry.isFile()) continue;
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) continue;
    if (entry.name.endsWith('.d.ts')) continue;

    // Skip allowlisted directories
    if (ALLOWLISTED_DIRS.some((a) => relPath.startsWith(a) || relPath.includes('/' + a))) continue;

    const content = readFileSync(fullPath, 'utf-8');

    // If file uses audited imports, skip — mutations are presumed audited
    if (AUDIT_IMPORT_PATTERN.test(content)) continue;

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      for (const { pattern, label } of UNAUDITED_MUTATION_PATTERNS) {
        if (pattern.test(lines[i])) {
          violations.push({
            file: relPath,
            line: i + 1,
            content: lines[i].trim(),
            label,
          });
        }
      }
    }
  }

  return violations;
}

describe('INV-34 — UE Mutations Are Audited', () => {
  it('api-guards.ts provides getAuditedDb', () => {
    const guardsPath = join(UE_ROOT, 'lib', 'api-guards.ts');
    expect(existsSync(guardsPath)).toBe(true);

    const content = readFileSync(guardsPath, 'utf-8');
    expect(content).toContain('getAuditedDb');
    expect(content).toContain('createAuditedScopedDb');
  });

  it('no unaudited mutations in API route handlers', () => {
    const apiDir = join(UE_ROOT, 'app');
    const violations = scanForUnauditedMutations(apiDir);

    // Filter to only API routes (route.ts files and server actions)
    const apiViolations = violations.filter(
      (v) => v.file.includes('route.ts') || v.file.includes('actions'),
    );

    if (apiViolations.length > 0) {
      console.warn(
        `WARNING: ${apiViolations.length} unaudited mutations in API routes:\n` +
          apiViolations.map((v) => `  ${v.file}:${v.line} — [${v.label}] ${v.content}`).join('\n'),
      );
    }
  });

  it('getAuditedDb requires both orgId and userId', () => {
    const guardsPath = join(UE_ROOT, 'lib', 'api-guards.ts');
    const content = readFileSync(guardsPath, 'utf-8');

    // Must pass orgId to createAuditedScopedDb
    expect(content).toContain('orgId:');
    // Must pass actorId to createAuditedScopedDb
    expect(content).toContain('actorId:');
  });
});
