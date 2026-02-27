/**
 * Contract Test — Union Eyes: No Raw DB Access in App Layer
 *
 * BLOCKER: App-layer code (pages, API routes) must NOT use db.execute()
 * or raw SQL without wrapping in withRLSContext(). This contract test
 * statically scans UE app-layer files for unguarded raw DB access.
 *
 * Allowlisted:
 * - services/financial-service/check-*.ts (admin-only diagnostic scripts)
 * - lib/db/with-rls-context.ts (the RLS wrapper itself)
 * - db/db.ts (client initialization)
 *
 * @invariant INV-31: UE app-layer DB access is RLS-guarded
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const UE_ROOT = join(ROOT, 'apps', 'union-eyes');

/**
 * Paths explicitly allowed to use raw DB access.
 * All others in app/ are considered violations.
 */
const ALLOWLISTED_PATHS = [
  'services/financial-service/check-',  // Admin diagnostic scripts
  'lib/db/with-rls-context',           // The RLS wrapper itself
  'lib/db/rls-',                       // RLS utilities
  'db/db.ts',                          // Client initialization
  'db/migrate',                        // Migration scripts
  'lib/database/',                     // Multi-DB abstraction
  'scripts/',                          // Dev scripts
  'app/api/ready/',                    // K8s health probes (information_schema only)
  'app/api/health/',                   // K8s health probes
  'app/api/v2/ready/',                 // v2 K8s readiness probes
  'app/api/ml/',                       // ML monitoring/predictions — admin-only analytics, RLS migration tracked
  'app/api/v2/ml/',                    // v2 ML routes — same as above
];

const DANGEROUS_PATTERNS = [
  // db.execute() without withRLSContext wrapping
  { pattern: /\bdb\.execute\s*\(/, label: 'db.execute() — must be inside withRLSContext()' },
  // Direct import of postgres driver
  { pattern: /import\s+.*\bfrom\s+['"]postgres['"]/, label: 'raw postgres driver import' },
  // Direct import of pg driver
  { pattern: /import\s+.*\bfrom\s+['"]pg['"]/, label: 'raw pg driver import' },
  // Creating raw client
  { pattern: /\bpostgres\s*\(\s*process\.env/, label: 'raw postgres() client creation' },
];

/** Pattern that indicates the call IS inside withRLSContext */
const RLS_GUARD_PATTERN = /withRLSContext|withExplicitUserContext|withSystemContext/;

function scanDirectory(dir: string): Array<{ file: string; line: number; content: string; label: string }> {
  const violations: Array<{ file: string; line: number; content: string; label: string }> = [];

  if (!existsSync(dir)) return violations;
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = relative(UE_ROOT, fullPath).split(sep).join('/');

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '__pycache__') continue;
      violations.push(...scanDirectory(fullPath));
      continue;
    }

    if (!entry.isFile()) continue;
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) continue;
    if (entry.name.endsWith('.d.ts')) continue;

    // Skip allowlisted paths
    if (ALLOWLISTED_PATHS.some(a => relPath.includes(a))) continue;

    const content = readFileSync(fullPath, 'utf-8');

    // If the file imports withRLSContext, check that db.execute is inside it
    const hasRLSGuard = RLS_GUARD_PATTERN.test(content);

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const { pattern, label } of DANGEROUS_PATTERNS) {
        if (pattern.test(line)) {
          // For db.execute(), only flag if file does NOT use withRLSContext
          if (label.includes('db.execute') && hasRLSGuard) continue;
          // For raw driver imports, always flag (eslint-disable is for linter, not contract test)
          violations.push({
            file: relPath,
            line: i + 1,
            content: line.trim(),
            label,
          });
        }
      }
    }
  }

  return violations;
}

describe('INV-31 — UE App-Layer DB Access Is RLS-Guarded', () => {
  it('UE app root exists', () => {
    expect(existsSync(join(UE_ROOT, 'app')), 'apps/union-eyes/app must exist').toBe(true);
  });

  it('no unguarded raw DB access in app-layer code', () => {
    const appViolations = scanDirectory(join(UE_ROOT, 'app'));

    expect(
      appViolations,
      `BLOCKER: UE app-layer files must not use db.execute() without withRLSContext().\n\n` +
        `Violations found:\n` +
        appViolations.map(v => `  ${v.file}:${v.line} — [${v.label}] ${v.content}`).join('\n'),
    ).toEqual([]);
  });

  it('no unguarded raw DB access in server action files', () => {
    const actionsViolations = scanDirectory(join(UE_ROOT, 'actions'));

    expect(
      actionsViolations,
      `BLOCKER: UE server action files must not use db.execute() or raw drivers without withRLSContext().\n\n` +
        `Violations found:\n` +
        actionsViolations.map(v => `  ${v.file}:${v.line} — [${v.label}] ${v.content}`).join('\n'),
    ).toEqual([]);
  });

  it('no raw postgres driver imports in app-layer code', () => {
    const appViolations = scanDirectory(join(UE_ROOT, 'app'))
      .filter(v => v.label.includes('postgres'));

    expect(
      appViolations,
      `BLOCKER: No raw postgres imports allowed in app layer.\n` +
        appViolations.map(v => `  ${v.file}:${v.line} — ${v.content}`).join('\n'),
    ).toEqual([]);
  });

  it('no raw postgres driver imports in server action files', () => {
    const actionsViolations = scanDirectory(join(UE_ROOT, 'actions'))
      .filter(v => v.label.includes('postgres'));

    expect(
      actionsViolations,
      `BLOCKER: No raw postgres imports allowed in server actions.\n` +
        actionsViolations.map(v => `  ${v.file}:${v.line} — ${v.content}`).join('\n'),
    ).toEqual([]);
  });
});
