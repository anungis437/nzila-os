#!/usr/bin/env node
/**
 * Production Surface Validator — Phase -1 (Production Surface Freeze).
 *
 * Source of truth: governance/readiness/production-surface.json
 * Human doc:       docs/readiness/production-surface-inventory.md
 *
 * Enforces that the production surface is FROZEN and unambiguous. Fails
 * (exit 1) if any of the following hold:
 *
 *   1. An app under apps/ is not classified in the manifest.
 *   2. A workflow under .github/workflows/ is not classified in the manifest.
 *   3. Any classification is UNKNOWN (UNKNOWN == production-blocking).
 *   4. Any classification value is outside the allowed enum.
 *   5. A RETIRED or TEST_ONLY app has a deploy workflow / active deploy path.
 *   6. An INTERNAL_ONLY app is publicly navigable or has a public domain.
 *   7. A DEMO app can touch production data.
 *   8. A PILOT app touches production data without a productionDataApproval ref.
 *   9. A PRODUCTION app lacks owner / deployWorkflow / domains / routeClassification / gateCoverage.
 *  10. Any app lacks an owner.
 *  11. A deploy workflow targets a RETIRED or TEST_ONLY app.
 *
 * This validator is NOT yet wired into `final:go`. See the "PROMOTION" note at
 * the end of its report for what remains before it can become production-blocking.
 *
 * Usage: pnpm validate:production-surface
 */

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const manifestPath = path.join(repoRoot, 'governance', 'readiness', 'production-surface.json');

const ENUM = ['PRODUCTION', 'PILOT', 'DEMO', 'INTERNAL_ONLY', 'RETIRED', 'TEST_ONLY', 'UNKNOWN'];

const violations = [];
const warnings = [];
function fail(rule, detail) {
  violations.push({ rule, detail });
}

if (!fs.existsSync(manifestPath)) {
  console.error(`FATAL: manifest missing at ${path.relative(repoRoot, manifestPath)}`);
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (err) {
  console.error(`FATAL: manifest is not valid JSON — ${err.message}`);
  process.exit(1);
}

const apps = manifest.apps ?? {};
const workflows = manifest.workflows ?? {};

// discover real surface from disk
const appsDir = path.join(repoRoot, 'apps');
const diskApps = fs
  .readdirSync(appsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

const wfDir = path.join(repoRoot, '.github', 'workflows');
const diskWorkflows = fs.existsSync(wfDir)
  ? fs.readdirSync(wfDir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
  : [];

// Rule 1 — every app on disk is classified
for (const name of diskApps) {
  if (!apps[name]) fail(1, `app "${name}" exists under apps/ but is not classified in the manifest (treated as UNKNOWN → blocking)`);
}
// stale manifest apps (warn only)
for (const name of Object.keys(apps)) {
  if (!diskApps.includes(name)) warnings.push(`manifest lists app "${name}" that no longer exists under apps/`);
}

// Rule 2 — every workflow on disk is classified
for (const wf of diskWorkflows) {
  if (!workflows[wf]) fail(2, `workflow "${wf}" exists but is not classified in the manifest (treated as UNKNOWN → blocking)`);
}
for (const wf of Object.keys(workflows)) {
  if (!diskWorkflows.includes(wf)) warnings.push(`manifest lists workflow "${wf}" that no longer exists`);
}

const retiredOrTest = new Set();

function hasDeployPath(entry) {
  return Array.isArray(entry.deployWorkflow) && entry.deployWorkflow.length > 0;
}

// App-level rules 3,4,5,6,7,8,9,10
for (const [name, a] of Object.entries(apps)) {
  const cls = a.classification;
  if (!ENUM.includes(cls)) fail(4, `app "${name}" has classification "${cls}" outside the allowed enum`);
  if (cls === 'UNKNOWN') fail(3, `app "${name}" is UNKNOWN (production-blocking)`);
  if (!a.owner || String(a.owner).trim() === '') fail(10, `app "${name}" has no owner`);

  if (cls === 'RETIRED' || cls === 'TEST_ONLY') {
    retiredOrTest.add(name);
    if (hasDeployPath(a)) fail(5, `${cls} app "${name}" declares a deploy workflow (${a.deployWorkflow.join(', ')}) — no active deploy path allowed`);
  }
  if (cls === 'INTERNAL_ONLY') {
    if (a.publicNavigation === true) fail(6, `INTERNAL_ONLY app "${name}" has publicNavigation=true`);
    if (Array.isArray(a.domains) && a.domains.length > 0) fail(6, `INTERNAL_ONLY app "${name}" declares public domains (${a.domains.join(', ')})`);
  }
  if (cls === 'DEMO' && a.productionData === true) {
    fail(7, `DEMO app "${name}" has productionData=true`);
  }
  if (cls === 'PILOT' && a.productionData === true && !a.productionDataApproval) {
    fail(8, `PILOT app "${name}" touches production data without a productionDataApproval reference`);
  }
  if (cls === 'PRODUCTION') {
    if (!a.owner) fail(9, `PRODUCTION app "${name}" lacks owner`);
    if (!hasDeployPath(a)) fail(9, `PRODUCTION app "${name}" lacks a deployWorkflow`);
    if (!Array.isArray(a.domains) || a.domains.length === 0) fail(9, `PRODUCTION app "${name}" lacks domains`);
    if (!a.routeClassification) fail(9, `PRODUCTION app "${name}" lacks routeClassification evidence`);
    if (!a.gateCoverage) fail(9, `PRODUCTION app "${name}" lacks gateCoverage evidence`);
  }
}

// Workflow-level rules 3,4,11
for (const [wf, w] of Object.entries(workflows)) {
  const cls = w.classification;
  if (!ENUM.includes(cls)) fail(4, `workflow "${wf}" has classification "${cls}" outside the allowed enum`);
  if (cls === 'UNKNOWN') fail(3, `workflow "${wf}" is UNKNOWN (production-blocking)`);
  if (w.kind === 'deploy' && Array.isArray(w.targets)) {
    for (const t of w.targets) {
      if (t === '*') continue;
      if (retiredOrTest.has(t)) {
        fail(11, `deploy workflow "${wf}" targets ${apps[t]?.classification} app "${t}" — no deploy path to retired/test surfaces`);
      }
    }
  }
}

// ── Report ──────────────────────────────────────────────────────────────────
const byClass = {};
for (const a of Object.values(apps)) byClass[a.classification] = (byClass[a.classification] ?? 0) + 1;

console.log('Production Surface Validation (Phase -1 freeze)');
console.log(`  manifest: ${path.relative(repoRoot, manifestPath)}`);
console.log(`  apps on disk: ${diskApps.length}  |  classified: ${Object.keys(apps).length}`);
console.log(`  workflows on disk: ${diskWorkflows.length}  |  classified: ${Object.keys(workflows).length}`);
console.log('  app classification counts: ' + JSON.stringify(byClass));
console.log(`  PRODUCTION apps declared: ${byClass.PRODUCTION ?? 0}`);

if (warnings.length) {
  console.log(`\n  warnings (${warnings.length}):`);
  for (const w of warnings) console.log(`    ! ${w}`);
}

if (Array.isArray(manifest.openBlockers) && manifest.openBlockers.length) {
  console.log(`\n  open surface blockers (informational — not gating this validator):`);
  for (const b of manifest.openBlockers) console.log(`    [${b.id}/${b.severity}] ${b.summary}`);
}

if (violations.length) {
  console.error(`\nPRODUCTION SURFACE: NOT FROZEN — ${violations.length} violation(s):`);
  for (const v of violations) console.error(`  FAIL [rule ${v.rule}] ${v.detail}`);
  process.exit(1);
}

console.log('\nPRODUCTION SURFACE: FROZEN — every app and workflow is classified; no UNKNOWN; no retired/test deploy path; no internal public exposure.');
console.log('NOTE: This does NOT assert production readiness. It asserts the surface is unambiguous.');
console.log('PROMOTION TO production-blocking (final:go) REQUIRES: resolve openBlockers OSB-1..7, add per-route');
console.log('classification + gateCoverage for any app promoted to PRODUCTION, and prove demo/pilot data isolation.');
process.exit(0);
