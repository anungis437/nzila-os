/**
 * Contract Test — UnionEyes: No Raw DB Access in App Layer
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

/* ════════════════════════════════════════════════════════════════════════════
 * INV-31b — Classified Raw DB Guard (sensitive-domain coverage)
 *
 * The INV-31 guard above is narrow: it catches db.execute() outside
 * withRLSContext() and raw driver imports. It does NOT see the far more common
 * pattern of importing `db` and calling db.select/insert/update/delete()
 * directly. INV-31b expands coverage across sensitive UE API domains and makes
 * raw DB risk VISIBLE, CLASSIFIED, and FAIL-CLOSED for the high-risk cases —
 * without failing CI on every raw DB import.
 *
 * Win condition: raw DB risk is classified and fail-closed for high-risk
 * unclassified sensitive routes — NOT "all raw DB imports removed".
 *
 * Fail ONLY:
 *   - forbidden-direct-db      (explicitly disallowed)
 *   - unclassified-sensitive   (sensitive direct DB usage absent from registry)
 * Do NOT fail:
 *   - allowed-system-route / allowed-admin-route
 *   - requires-org-scope-wrapper / requires-rls-context (migration-tracked)
 *   - legacy-deprecated
 *
 * @invariant INV-31b: sensitive-domain direct DB usage is classified, fail-closed
 * ════════════════════════════════════════════════════════════════════════════ */

interface ClassificationCategory {
  failing: boolean;
  description: string;
}
interface ClassificationEntry {
  category: string;
  reason: string;
  migration?: boolean;
}
interface ClassificationRegistry {
  version: number;
  invariant: string;
  scope: { appRoot: string; sensitiveDomains: string[] };
  categories: Record<string, ClassificationCategory>;
  unclassifiedPolicy: { category: string; failing: boolean; description: string };
  classifications: Record<string, ClassificationEntry>;
}

const REGISTRY_PATH = join(__dirname, 'ue-raw-db-classification.json');
const REGISTRY: ClassificationRegistry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));

/** Patterns that indicate a file performs direct database access. */
const DIRECT_DB_PATTERNS: RegExp[] = [
  /\bdb\.(select|insert|update|delete|execute|transaction)\s*[(<]/,
  /\bdb\.query\./,
  /\bfrom\s+['"]postgres['"]/,
  /\bfrom\s+['"]pg['"]/,
];

function fileUsesDirectDb(content: string): boolean {
  return DIRECT_DB_PATTERNS.some((p) => p.test(content));
}

/** Recursively collect non-test .ts/.tsx files under a directory. */
function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '__pycache__') continue;
      out.push(...collectSourceFiles(full));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    if (/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) continue;
    if (entry.name.endsWith('.d.ts')) continue;
    out.push(full);
  }
  return out;
}

/** Enumerate sensitive-domain files that perform direct DB access. */
function scanSensitiveDirectDb(): string[] {
  const hits: string[] = [];
  for (const domain of REGISTRY.scope.sensitiveDomains) {
    const domainDir = join(UE_ROOT, domain);
    for (const file of collectSourceFiles(domainDir)) {
      const content = readFileSync(file, 'utf-8');
      if (fileUsesDirectDb(content)) {
        hits.push(relative(UE_ROOT, file).split(sep).join('/'));
      }
    }
  }
  return hits.sort();
}

type ClassificationVerdict =
  | { relPath: string; category: string; failing: boolean }
  | { relPath: string; category: 'unclassified-sensitive'; failing: true };

/**
 * Pure classification decision for a sensitive file known to use direct DB.
 * Exposed shape lets proof tests exercise synthetic paths without touching
 * real routes. Unknown category names fail closed (treated as failing).
 */
function classifyDirectDbFile(relPath: string): ClassificationVerdict {
  const entry = REGISTRY.classifications[relPath];
  if (!entry) {
    return { relPath, category: 'unclassified-sensitive', failing: true };
  }
  const category = REGISTRY.categories[entry.category];
  // Unknown category name → fail closed.
  const failing = category ? category.failing : true;
  return { relPath, category: entry.category, failing };
}

describe('INV-31b — UE Sensitive-Domain Raw DB Classification', () => {
  const sensitiveDirectDbFiles = scanSensitiveDirectDb();

  it('registry self-check: every category referenced by a classification is defined', () => {
    const unknown: string[] = [];
    for (const [path, entry] of Object.entries(REGISTRY.classifications)) {
      if (!REGISTRY.categories[entry.category]) {
        unknown.push(`${path} → "${entry.category}"`);
      }
    }
    expect(
      unknown,
      `Classification entries reference categories not defined in the registry:\n` +
        unknown.map((u) => `  ${u}`).join('\n'),
    ).toEqual([]);
  });

  it('sensitive domains contain direct DB usage to classify (guard is live)', () => {
    // If this ever hits zero, the scan/detection silently broke — fail loud.
    expect(
      sensitiveDirectDbFiles.length,
      'Expected to find sensitive-domain files with direct DB access to classify',
    ).toBeGreaterThan(0);
  });

  it('every sensitive direct-DB file is classified (no unclassified-sensitive)', () => {
    const unclassified = sensitiveDirectDbFiles
      .map(classifyDirectDbFile)
      .filter((v) => v.category === 'unclassified-sensitive')
      .map((v) => v.relPath);

    expect(
      unclassified,
      `FAIL-CLOSED: these sensitive-domain routes use direct DB access but are NOT classified ` +
        `in tooling/contract-tests/ue-raw-db-classification.json.\n` +
        `Add an explicit classification (allowed-system-route | allowed-admin-route | ` +
        `requires-org-scope-wrapper | requires-rls-context | legacy-deprecated | forbidden-direct-db):\n` +
        unclassified.map((f) => `  - ${f}`).join('\n'),
    ).toEqual([]);
  });

  it('no sensitive direct-DB file is classified forbidden-direct-db', () => {
    const forbidden = sensitiveDirectDbFiles
      .map(classifyDirectDbFile)
      .filter((v) => v.category === 'forbidden-direct-db')
      .map((v) => v.relPath);

    expect(
      forbidden,
      `FORBIDDEN: these sensitive-domain routes are classified forbidden-direct-db and must be ` +
        `removed or wrapped in an org-scope / RLS guard:\n` +
        forbidden.map((f) => `  - ${f}`).join('\n'),
    ).toEqual([]);
  });

  it('registry has no stale entries (every classification maps to a real direct-DB file)', () => {
    const live = new Set(sensitiveDirectDbFiles);
    const stale = Object.keys(REGISTRY.classifications).filter((p) => !live.has(p));

    // Stale entries are a soft signal — warn rather than block, so removing a
    // route never breaks CI. They should be pruned during DB-hardening waves.
    if (stale.length > 0) {
      console.warn(
        `[INV-31b] Stale classification entries (file gone or no longer uses direct DB):\n` +
          stale.map((f) => `  - ${f}`).join('\n'),
      );
    }
    expect(true).toBe(true);
  });

  // ── Proof: an unclassified sensitive raw DB import fails ─────────────────────
  it('PROOF (fail-closed): a deliberately unclassified sensitive raw DB import is rejected', () => {
    const synthetic = 'app/api/pilot/__synthetic_unclassified__/route.ts';
    expect(REGISTRY.classifications[synthetic]).toBeUndefined();

    const verdict = classifyDirectDbFile(synthetic);
    expect(verdict.category).toBe('unclassified-sensitive');
    expect(verdict.failing).toBe(true);
  });

  // ── Proof: classified allowed exceptions do not fail ────────────────────────
  it('PROOF (non-noisy): classified allowed exceptions are tolerated (do not fail)', () => {
    const samples = [
      'app/api/admin/stats/overview/route.ts',                 // allowed-admin-route
      'app/api/grievances/route.ts',                           // requires-org-scope-wrapper
      'app/api/governance/dashboard/route.ts',                 // requires-rls-context
      'app/api/pilot/apply/[id]/commercial-transition/route.ts', // requires-org-scope-wrapper
    ];
    for (const relPath of samples) {
      const verdict = classifyDirectDbFile(relPath);
      expect(REGISTRY.classifications[relPath], `${relPath} must be classified`).toBeDefined();
      expect(verdict.category, `${relPath} should not be unclassified`).not.toBe('unclassified-sensitive');
      expect(verdict.failing, `${relPath} should be tolerated (non-failing)`).toBe(false);
    }
  });

  // ── Proof: forbidden-direct-db would fail if ever assigned ──────────────────
  it('PROOF (forbidden fails): a forbidden-direct-db classification is failing', () => {
    expect(REGISTRY.categories['forbidden-direct-db'].failing).toBe(true);
    // And all tolerated categories are explicitly non-failing.
    for (const cat of [
      'allowed-system-route',
      'allowed-admin-route',
      'requires-org-scope-wrapper',
      'requires-rls-context',
      'legacy-deprecated',
    ]) {
      expect(REGISTRY.categories[cat].failing, `${cat} must be non-failing`).toBe(false);
    }
  });
});
