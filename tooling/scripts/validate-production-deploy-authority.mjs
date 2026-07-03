#!/usr/bin/env node
/**
 * Production Deploy Authority Validator — Phase 4A.
 *
 * Cross-checks the deploy pipeline against the frozen production surface and the
 * deployment inventory so that production deploy authority is provably bounded.
 *
 * Sources of truth:
 *   - governance/readiness/production-surface.json     (surface classification)
 *   - governance/release/deployment-inventory.json     (releaseStatus, prod eligibility, rollback exceptions)
 *   - .github/workflows/*.yml                           (credential method, app input, allow-list wiring)
 *
 * FAILS (exit 1) if:
 *   V1. A deploy workflow uses the long-lived `secrets.AZURE_CREDENTIALS` credential.
 *   V2. A production-eligible app is surface-classified INTERNAL_ONLY / RETIRED / TEST_ONLY / UNKNOWN.
 *   V3. A production-eligible app lacks a valid structured production exception
 *       (governance/release/production-exceptions.json: owner + future expiry +
 *       scope + rollback plan + limitation), or any exception is expired/incomplete.
 *   V4. A production workflow accepts a wildcard app input without routing through
 *       the policy resolver (scripts/release/resolve-deploy-apps.ts) before login.
 *   V5. A production workflow exposes a hard-coded app choice that is a forbidden surface class.
 *   V6. A PILOT app has production eligibility with no exception/approval reference at all.
 *
 * Mirrors the production-eligibility policy in scripts/release/resolve-deploy-apps.ts.
 * Advisory in the gate registry (targetClassification: production-blocking) — it
 * currently reports REAL open blockers; it is not wired into final:go.
 *
 * Usage: pnpm validate:production-deploy-authority
 */

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const surfacePath = path.join(repoRoot, 'governance', 'readiness', 'production-surface.json');
const inventoryPath = path.join(repoRoot, 'governance', 'release', 'deployment-inventory.json');
const wfDir = path.join(repoRoot, '.github', 'workflows');

const FORBIDDEN_PROD_CLASSES = new Set(['INTERNAL_ONLY', 'RETIRED', 'TEST_ONLY', 'UNKNOWN']);
const today = new Date().toISOString().slice(0, 10);

const violations = [];
const info = [];
function fail(id, detail) {
  violations.push({ id, detail });
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const surface = readJson(surfacePath);
const inventory = readJson(inventoryPath);
const surfaceApps = surface.apps ?? {};
const surfaceWorkflows = surface.workflows ?? {};
const invApps = inventory.apps ?? {};

// ── Production eligibility (mirrors resolve-deploy-apps.ts production branch) ──
function prodEligible(name, cfg) {
  if (name === 'zonga') return false; // requires explicit --zonga-override
  // Phase 4B: internal-only is NOT production-promotable (mirrors resolver).
  return cfg.prodPromotionEligible === true || cfg.releaseStatus === 'prod-approved';
}

const prodEligibleApps = Object.entries(invApps)
  .filter(([name, cfg]) => prodEligible(name, cfg))
  .map(([name]) => name);

info.push(`production-eligible apps (policy): ${prodEligibleApps.join(', ') || 'none'}`);

// V2 — forbidden surface class with production authority
for (const name of prodEligibleApps) {
  const cls = surfaceApps[name]?.classification ?? 'UNKNOWN';
  if (FORBIDDEN_PROD_CLASSES.has(cls)) {
    fail('V2', `production-eligible app "${name}" is surface-classified ${cls} — forbidden from production deploy`);
  }
}

// V3 — every production-eligible app needs a VALID structured production exception
// (owner + future expiry + scope + rollback plan + explicit limitation). This is
// stronger than a bare inventory expiry: an expired or incomplete exception fails.
const exceptionsPath = path.join(repoRoot, 'governance', 'release', 'production-exceptions.json');
let exceptions = {};
let requiredExceptionFields = ['type', 'owner', 'expiry', 'scope', 'rollbackPlan', 'limitation', 'status'];
if (!fs.existsSync(exceptionsPath)) {
  fail('V3', 'production exceptions file missing: governance/release/production-exceptions.json');
} else {
  const ex = readJson(exceptionsPath);
  exceptions = ex.exceptions ?? {};
  if (Array.isArray(ex.requiredFields)) requiredExceptionFields = ex.requiredFields;
  // Every entry in the file must itself be complete and non-expired.
  for (const [name, e] of Object.entries(exceptions)) {
    const missing = requiredExceptionFields.filter((f) => !e[f]);
    if (missing.length) fail('V3', `production exception "${name}" is incomplete (missing: ${missing.join(', ')})`);
    if (e.expiry && e.expiry < today) fail('V3', `production exception "${name}" is EXPIRED (expiry ${e.expiry} < ${today})`);
  }
}
for (const name of prodEligibleApps) {
  const ex = exceptions[name];
  if (!ex) {
    fail('V3', `production-eligible app "${name}" has no entry in production-exceptions.json`);
    continue;
  }
  const missing = requiredExceptionFields.filter((f) => !ex[f]);
  if (missing.length) fail('V3', `production exception for eligible app "${name}" is incomplete (missing: ${missing.join(', ')})`);
  if (ex.expiry && ex.expiry < today) fail('V3', `production exception for eligible app "${name}" is EXPIRED (expiry ${ex.expiry} < ${today})`);
}

// ── Workflow scans ────────────────────────────────────────────────────────────
const wfFiles = fs.existsSync(wfDir)
  ? fs.readdirSync(wfDir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
  : [];

function stripComments(text) {
  return text
    .split(/\r?\n/)
    .filter((l) => !l.trimStart().startsWith('#'))
    .join('\n');
}

for (const wf of wfFiles) {
  const raw = fs.readFileSync(path.join(wfDir, wf), 'utf8');
  const body = stripComments(raw);
  const meta = surfaceWorkflows[wf];
  const isDeploy = meta?.kind === 'deploy';
  const touchesProd = meta?.classification === 'PRODUCTION' || /environment:\s*production\b/.test(body);

  // V1 — long-lived credential in any deploy workflow
  if (isDeploy && /secrets\.AZURE_CREDENTIALS/.test(body)) {
    fail('V1', `deploy workflow "${wf}" uses long-lived secrets.AZURE_CREDENTIALS`);
  }

  if (!isDeploy) continue;

  // V4 — wildcard production app input without policy resolver
  const hasWildcardAppInput = /inputs:[\s\S]*?\bapps:\s*\n/.test(body) && !/options:/.test(body);
  const usesResolver = /resolve-deploy-apps/.test(body);
  if (touchesProd && hasWildcardAppInput && !usesResolver) {
    fail('V4', `production workflow "${wf}" accepts a wildcard app input without routing through resolve-deploy-apps.ts`);
  }

  // V5 — hard-coded app choice list containing a forbidden-class app
  if (touchesProd) {
    for (const [name, a] of Object.entries(surfaceApps)) {
      if (!FORBIDDEN_PROD_CLASSES.has(a.classification)) continue;
      // match "- nzila-os-<name>" or "- <name>" choice entries
      const re = new RegExp(`^\\s*-\\s*(nzila-os-)?${name}\\s*$`, 'm');
      if (re.test(body) && /options:/.test(body)) {
        fail('V5', `production workflow "${wf}" offers ${a.classification} app "${name}" as a deploy choice`);
      }
    }
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
console.log('Production Deploy Authority Validation (Phase 4A)');
for (const i of info) console.log(`  - ${i}`);
console.log(`  deploy workflows scanned: ${wfFiles.filter((w) => surfaceWorkflows[w]?.kind === 'deploy').length}`);

if (violations.length) {
  console.error(`\nDEPLOY AUTHORITY: BLOCKED — ${violations.length} violation(s):`);
  for (const v of violations) console.error(`  FAIL [${v.id}] ${v.detail}`);
  console.error('\nThese are REAL open deployment blockers. See docs/readiness/deployment-authority-inventory.md.');
  process.exit(1);
}

console.log('\nDEPLOY AUTHORITY: BOUNDED — no long-lived credential, no forbidden-class production deploy, no expired exception, no unfiltered wildcard.');
process.exit(0);
