#!/usr/bin/env node
/**
 * BR-6 Organization Context Closure Validator — Phase 2.
 *
 * Goes beyond the forbidden-pattern guardrail (validate:org-resolver-guardrail).
 * Proves the org-context substrate cannot silently drift to a default org.
 *
 * FAILS (exit 1) if:
 *   B1. The canonical resolver is missing or has lost its fail-closed guard
 *       (isDefaultOrgFallbackAllowed + OrgContextRequiredError in
 *       apps/union-eyes/lib/organization-utils.ts).
 *   B2. Any non-test runtime path silently falls back to the default org:
 *         `|| process.env.DEFAULT_ORGANIZATION_ID`
 *         `|| 'default-org'` / `|| "default-org"`
 *   B3. Any service/job (background) path reads process.env.DEFAULT_ORGANIZATION_ID
 *       as an org authority without the canonical fail-closed guard.
 *   B4. The BR-6 fail-closed negative tests are missing (cannot be deleted to pass).
 *
 * Advisory in the gate registry (targetClassification: production-blocking): it
 * currently reports REAL remaining legacy fallbacks; BR-6 is PARTIALLY CLOSED.
 *
 * Usage: pnpm validate:br6-org-context
 */

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const canonicalResolver = path.join(
  repoRoot,
  'apps',
  'union-eyes',
  'lib',
  'organization-utils.ts',
);

const scanRoots = [
  path.join(repoRoot, 'apps', 'union-eyes', 'app'),
  path.join(repoRoot, 'apps', 'union-eyes', 'lib'),
  path.join(repoRoot, 'apps', 'union-eyes', 'services'),
];

const skipDir = new Set(['node_modules', '.next', '.turbo', 'dist', 'coverage', '__tests__']);
const exts = new Set(['.ts', '.tsx']);

const violations = [];
function fail(id, detail) {
  violations.push({ id, detail });
}

function isTestFile(p) {
  return /\.test\.tsx?$/.test(p) || /\.spec\.tsx?$/.test(p);
}

function* walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (skipDir.has(e.name)) continue;
      yield* walk(path.join(dir, e.name));
    } else if (e.isFile() && exts.has(path.extname(e.name)) && !isTestFile(e.name)) {
      yield path.join(dir, e.name);
    }
  }
}

// B1 — canonical resolver has its fail-closed guard
if (!fs.existsSync(canonicalResolver)) {
  fail('B1', `canonical resolver missing: ${path.relative(repoRoot, canonicalResolver)}`);
} else {
  const src = fs.readFileSync(canonicalResolver, 'utf8');
  const hasGuardFn = /function isDefaultOrgFallbackAllowed\s*\(/.test(src);
  const hasError = /class OrgContextRequiredError/.test(src);
  const guardsBeforeFallback = /isDefaultOrgFallbackAllowed\(\)/.test(src) && /throw new OrgContextRequiredError/.test(src);
  if (!hasGuardFn) fail('B1', 'canonical resolver lost isDefaultOrgFallbackAllowed()');
  if (!hasError) fail('B1', 'canonical resolver lost OrgContextRequiredError');
  if (!guardsBeforeFallback) fail('B1', 'canonical resolver no longer fails closed before the default-org fallback');
}

// B4 — the BR-6 fail-closed negative tests must exist (cannot be deleted to pass)
const resolverTest = path.join(
  repoRoot,
  'apps',
  'union-eyes',
  'lib',
  '__tests__',
  'organization-utils.test.ts',
);
if (!fs.existsSync(resolverTest)) {
  fail('B4', `resolver test file missing: ${path.relative(repoRoot, resolverTest)}`);
} else {
  const t = fs.readFileSync(resolverTest, 'utf8');
  const hasProdReject = /fails closed when user has no verified membership/.test(t);
  const hasOptIn = /default org fallback only when explicitly opted in/.test(t);
  if (!hasProdReject) fail('B4', 'missing production fail-closed negative test for getOrganizationIdForUser');
  if (!hasOptIn) fail('B4', 'missing explicit non-production opt-in test for default-org fallback');
}

// B2/B3 — scan runtime paths for silent default-org fallback
const forbidden = [
  { id: 'B2', label: 'silent || process.env.DEFAULT_ORGANIZATION_ID fallback', re: /\|\|\s*process\.env\.DEFAULT_ORGANIZATION_ID/ },
  { id: 'B2', label: "silent || 'default-org' fallback", re: /\|\|\s*['"]default-org['"]/ },
  { id: 'B3', label: 'background/service path reads process.env.DEFAULT_ORGANIZATION_ID as org authority', re: /process\.env\.DEFAULT_ORGANIZATION_ID/ },
];

for (const root of scanRoots) {
  for (const file of walk(root)) {
    const rel = path.relative(repoRoot, file).replaceAll('\\', '/');
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) return;
      for (const f of forbidden) {
        if (f.re.test(line)) {
          // B3 is a superset of B2 hits; only record B3 when B2 forms are absent on the line
          if (f.id === 'B3' && /\|\|\s*process\.env\.DEFAULT_ORGANIZATION_ID/.test(line)) continue;
          fail(f.id, `${rel}:${i + 1} — ${f.label}: ${line.trim().slice(0, 80)}`);
        }
      }
    });
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
console.log('BR-6 Organization Context Closure Validation (Phase 2)');
console.log(`  canonical resolver: ${path.relative(repoRoot, canonicalResolver)}`);

if (violations.length) {
  const b1 = violations.filter((v) => v.id === 'B1').length;
  console.error(`\nBR-6: NOT CLOSED — ${violations.length} violation(s) (B1 structural: ${b1}):`);
  for (const v of violations) console.error(`  FAIL [${v.id}] ${v.detail}`);
  console.error('\nSee docs/readiness/br6-org-context-closure.md. Canonical resolver fails closed;');
  console.error('remaining violations are legacy service/job paths that must delegate to it or fail closed.');
  process.exit(1);
}

console.log('\nBR-6: CLOSED — single fail-closed canonical resolver; no silent default-org fallback in runtime paths.');
process.exit(0);
