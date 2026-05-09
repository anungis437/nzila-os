#!/usr/bin/env node
/**
 * Operational Proving Validator
 *
 * Verifies that the operational proving corpus and its real evidence
 * artifacts are present and internally consistent.
 *
 * Authority: docs/nzila-operational-proving/master-operational-proving-index.md
 *
 * Exit code 0 on all-pass, 1 on any failure.
 */

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const docsRoot = path.join(repoRoot, 'docs', 'nzila-operational-proving');
const masterIndex = path.join(docsRoot, 'master-operational-proving-index.md');
const evidenceRoot = path.join(repoRoot, 'proof-artifacts', 'operational-proving');
const ledgerRoot = path.join(repoRoot, 'proof-artifacts', 'rollout-attestations');
const manifestPath = path.join(evidenceRoot, 'proving-manifest.json');

const REQUIRED_DOCS = [
  'master-operational-proving-index.md',
  'full-environment-traversal-rehearsal.md',
  'live-rollback-proving.md',
  'promotion-refusal-proving.md',
  'live-operator-walkthrough-program.md',
  'executive-operational-readability-proving.md',
  'cross-app-operational-convergence-proving.md',
  'live-cadence-sustainability-validation.md',
  'environment-restoration-proving.md',
  'live-pilot-operations-proving.md',
  'phase-c-final-readiness-review.md',
];

const REQUIRED_LOGS = [
  'promote-dev-to-staging.log',
  'promote-staging-to-demo.log',
  'promote-staging-to-pilot.log',
  'promote-pilot-to-prod.log',
  'refusals.log',
  'rollback-pilot.log',
  'restore-pilot.log',
  'readiness-review.log',
];

const REQUIRED_REFUSAL_SUBSTRINGS = [
  'not in the governed promotion graph',
  'inside open continuity window',
  'allowed: none',
  'non-trivial string',
];

const AUTHORITY_PHRASE = 'master-operational-proving-index.md';

const checks = [];
let failed = 0;
function record(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  if (!ok) failed++;
}

// 1. all required docs present
let allDocsPresent = true;
for (const name of REQUIRED_DOCS) {
  if (!fs.existsSync(path.join(docsRoot, name))) {
    allDocsPresent = false;
    record(`required doc present: ${name}`, false);
  }
}
if (allDocsPresent) record('all 11 operational-proving docs present', true);

// 2. master index references every doc
if (fs.existsSync(masterIndex)) {
  const indexBody = fs.readFileSync(masterIndex, 'utf8');
  let allLinked = true;
  for (const name of REQUIRED_DOCS) {
    if (name === 'master-operational-proving-index.md') continue;
    if (!indexBody.includes(name)) {
      allLinked = false;
      record(`master index references ${name}`, false);
    }
  }
  if (allLinked) record('master index references every proving doc', true);
} else {
  record('master index exists', false);
}

// 3. every non-index doc cites the master index
let allCite = true;
for (const name of REQUIRED_DOCS) {
  if (name === 'master-operational-proving-index.md') continue;
  const p = path.join(docsRoot, name);
  if (!fs.existsSync(p)) continue;
  const body = fs.readFileSync(p, 'utf8');
  if (!body.includes(AUTHORITY_PHRASE)) {
    allCite = false;
    record(`authority cited in ${name}`, false);
  }
}
if (allCite) record('every proving doc cites the master index as authority', true);

// 4. every doc has a Status header
let allStatus = true;
for (const name of REQUIRED_DOCS) {
  const p = path.join(docsRoot, name);
  if (!fs.existsSync(p)) continue;
  const body = fs.readFileSync(p, 'utf8');
  if (!/^\*\*Status:\*\*\s+\w+/m.test(body) && !body.includes('Authority root:')) {
    allStatus = false;
    record(`status header in ${name}`, false);
  }
}
if (allStatus) record('every proving doc has a status header', true);

// 5. companion layer linkage
const masterBody = fs.existsSync(masterIndex) ? fs.readFileSync(masterIndex, 'utf8') : '';
record(
  'master index references field-operations corpus',
  masterBody.includes('nzila-field-operations/master-field-operations-index.md'),
);
record(
  'master index references rollout-governance corpus',
  masterBody.includes('nzila-rollout-governance/master-rollout-governance-index.md'),
);

// 6. evidence dir + manifest
record('operational-proving evidence dir exists', fs.existsSync(evidenceRoot));
record('proving manifest exists', fs.existsSync(manifestPath));

let manifest = null;
if (fs.existsSync(manifestPath)) {
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    record('proving manifest parses as JSON', true);
  } catch (err) {
    record('proving manifest parses as JSON', false, String(err.message));
  }
}

// 7. evidence logs present
let allLogs = true;
for (const log of REQUIRED_LOGS) {
  const p = path.join(evidenceRoot, log);
  if (!fs.existsSync(p)) {
    allLogs = false;
    record(`evidence log present: ${log}`, false);
  }
}
if (allLogs) record('all required evidence logs present', true);

// 8. refusals log contains the four expected substrings
const refusalsPath = path.join(evidenceRoot, 'refusals.log');
if (fs.existsSync(refusalsPath)) {
  const body = fs.readFileSync(refusalsPath, 'utf8');
  for (const sub of REQUIRED_REFUSAL_SUBSTRINGS) {
    record(`refusals.log contains: "${sub}"`, body.includes(sub));
  }
}

// 9. ledger coverage
function readJsonl(p) {
  if (!fs.existsSync(p)) return [];
  return fs
    .readFileSync(p, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

const promotionFiles = fs.existsSync(ledgerRoot)
  ? fs.readdirSync(ledgerRoot).filter((f) => f.startsWith('promotions-') && f.endsWith('.jsonl'))
  : [];
const allPromotions = promotionFiles.flatMap((f) => readJsonl(path.join(ledgerRoot, f)));

const targetTiers = ['staging', 'demo', 'pilot', 'prod'];
for (const tier of targetTiers) {
  const found = allPromotions.some(
    (p) => p?.subject?.tier === tier || p?.tier === tier || p?.target_tier === tier,
  );
  record(`promotion ledger has at least one entry for tier=${tier}`, found);
}

const rollbackFiles = fs.existsSync(ledgerRoot)
  ? fs.readdirSync(ledgerRoot).filter((f) => f.startsWith('rollbacks-') && f.endsWith('.jsonl'))
  : [];
const rollbacks = rollbackFiles.flatMap((f) => readJsonl(path.join(ledgerRoot, f)));
record('rollback ledger has at least one entry', rollbacks.length > 0);

const restorationFiles = fs.existsSync(ledgerRoot)
  ? fs.readdirSync(ledgerRoot).filter((f) => f.startsWith('restorations-') && f.endsWith('.jsonl'))
  : [];
const restorations = restorationFiles.flatMap((f) => readJsonl(path.join(ledgerRoot, f)));
record('restoration ledger has at least one entry', restorations.length > 0);

// 10. manifest attestation IDs are real (each appears in a ledger)
if (manifest) {
  const ledgerIdSet = new Set([
    ...allPromotions.map((p) => p.attestation_id),
    ...rollbacks.map((p) => p.attestation_id),
    ...restorations.map((p) => p.attestation_id),
  ]);
  const manifestIds = [
    ...(manifest.traversal?.edges || []).map((e) => e.attestation_id),
    manifest.rollback?.attestation_id,
    manifest.restoration?.attestation_id,
  ].filter(Boolean);
  let allFound = true;
  for (const id of manifestIds) {
    if (!ledgerIdSet.has(id)) {
      allFound = false;
      record(`manifest attestation id present in ledger: ${id}`, false);
    }
  }
  if (allFound)
    record(
      `all ${manifestIds.length} manifest attestation ids resolve in the ledger`,
      true,
    );
}

// 11. anti-pattern guards across the proving corpus
const antiPatternBlocklist = ['leaderboard', 'per-operator scorecard', 'readiness score'];
let antiPatternClean = true;
for (const name of REQUIRED_DOCS) {
  const p = path.join(docsRoot, name);
  if (!fs.existsSync(p)) continue;
  const body = fs.readFileSync(p, 'utf8').toLowerCase();
  for (const phrase of antiPatternBlocklist) {
    if (body.includes(phrase) && !body.includes('no ' + phrase) && !body.includes('no operator scorecard')) {
      antiPatternClean = false;
      record(`anti-pattern "${phrase}" present in ${name}`, false);
    }
  }
}
if (antiPatternClean) record('proving corpus refuses scoring/leaderboard language', true);

// render
const ok = checks.filter((c) => c.ok).length;
console.log('Operational proving validation');
for (const c of checks) {
  console.log(`  ${c.ok ? 'ok   ' : 'FAIL '} ${c.name}${c.detail ? ' — ' + c.detail : ''}`);
}
if (failed > 0) {
  console.log(`\nOperational proving: ${failed} failure(s) (${ok} passing).`);
  process.exit(1);
}
console.log(`\nOperational proving: OK. (${ok} checks)`);
