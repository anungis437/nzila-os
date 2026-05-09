#!/usr/bin/env node
/**
 * Final GO Status Validator
 *
 * Verifies that the Phase D finalization corpus, the per-environment
 * GO certifications, the convergence audit, the legitimacy audit,
 * the rehearsal log, and the proving anchor are all present and
 * internally consistent.
 *
 * Emits "NZILA FINAL GO STATUS: CERTIFIED" with per-tier GO lines
 * ONLY when every check passes.
 *
 * Authority: docs/nzila-finalization/master-finalization-index.md
 *
 * Exit code 0 on certified, 1 on any failure.
 */

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const docsRoot = path.join(repoRoot, 'docs', 'nzila-finalization');
const masterIndex = path.join(docsRoot, 'master-finalization-index.md');
const finalizationRoot = path.join(repoRoot, 'proof-artifacts', 'finalization');
const certsRoot = path.join(finalizationRoot, 'certifications');
const ledgerRoot = path.join(repoRoot, 'proof-artifacts', 'rollout-attestations');
const provingManifestPath = path.join(
  repoRoot,
  'proof-artifacts',
  'operational-proving',
  'proving-manifest.json',
);
const finalizationManifestPath = path.join(
  finalizationRoot,
  'finalization-manifest.json',
);

const REQUIRED_DOCS = [
  'master-finalization-index.md',
  'full-ecosystem-convergence-finalization.md',
  'canonical-operating-system-navigation.md',
  'full-role-experience-convergence.md',
  'executive-operating-system-finalization.md',
  'full-environment-go-certification-program.md',
  'production-readiness-hardening.md',
  'live-full-chain-operational-rehearsal.md',
  'cross-app-e2e-validation-matrix.md',
  'final-operational-legitimacy-audit.md',
  'final-operating-system-readiness-review.md',
];

const REQUIRED_TIERS = ['dev', 'staging', 'demo', 'pilot', 'prod'];

const REQUIRED_AREAS = [
  'governance legitimacy',
  'operational legitimacy',
  'rollout legitimacy',
  'restoration legitimacy',
  'continuity legitimacy',
  'executive readability',
  'operational sustainability',
  'cadence sustainability',
  'convergence integrity',
  'onboarding legitimacy',
];

const AUTHORITY_PHRASE = 'master-finalization-index.md';

const checks = [];
let failed = 0;
function record(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  if (!ok) failed++;
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

// 1. all required docs present
let allDocsPresent = true;
for (const name of REQUIRED_DOCS) {
  if (!fs.existsSync(path.join(docsRoot, name))) {
    allDocsPresent = false;
    record(`required doc present: ${name}`, false);
  }
}
if (allDocsPresent) record('all 11 finalization docs present', true);

// 2. master index references every doc
if (fs.existsSync(masterIndex)) {
  const indexBody = fs.readFileSync(masterIndex, 'utf8');
  let allLinked = true;
  for (const name of REQUIRED_DOCS) {
    if (name === 'master-finalization-index.md') continue;
    if (!indexBody.includes(name)) {
      allLinked = false;
      record(`master index references ${name}`, false);
    }
  }
  if (allLinked) record('master index references every finalization doc', true);
} else {
  record('master finalization index exists', false);
}

// 3. every non-index doc cites the master index
let allCite = true;
for (const name of REQUIRED_DOCS) {
  if (name === 'master-finalization-index.md') continue;
  const p = path.join(docsRoot, name);
  if (!fs.existsSync(p)) continue;
  const body = fs.readFileSync(p, 'utf8');
  if (!body.includes(AUTHORITY_PHRASE)) {
    allCite = false;
    record(`authority cited in ${name}`, false);
  }
}
if (allCite) record('every finalization doc cites master index', true);

// 4. evidence dirs + manifests
record('finalization evidence dir exists', fs.existsSync(finalizationRoot));
record('certifications dir exists', fs.existsSync(certsRoot));
record('finalization manifest exists', fs.existsSync(finalizationManifestPath));
record('proving manifest anchor exists', fs.existsSync(provingManifestPath));
record(
  'convergence audit exists',
  fs.existsSync(path.join(finalizationRoot, 'convergence-audit.json')),
);
record(
  'legitimacy audit exists',
  fs.existsSync(path.join(finalizationRoot, 'legitimacy-audit.json')),
);
record(
  'rehearsal log exists',
  fs.existsSync(path.join(finalizationRoot, 'rehearsal-log.md')),
);

// 5. per-tier GO certifications
const certs = {};
let allCertsGO = true;
for (const tier of REQUIRED_TIERS) {
  const p = path.join(certsRoot, `${tier}.json`);
  if (!fs.existsSync(p)) {
    allCertsGO = false;
    record(`certification artifact present: ${tier}`, false);
    continue;
  }
  const cert = readJson(p);
  if (!cert) {
    allCertsGO = false;
    record(`certification ${tier} parses`, false);
    continue;
  }
  certs[tier] = cert;
  if (cert.tier !== tier) {
    allCertsGO = false;
    record(`certification ${tier} self-identifies as tier=${tier}`, false);
  }
  if (cert.verdict !== 'GO') {
    allCertsGO = false;
    record(`certification ${tier} verdict is GO`, false, `actual=${cert.verdict}`);
  }
  // every required area present and PROVEN or N/A
  const areaMap = new Map((cert.areas ?? []).map((a) => [a.area, a.state]));
  for (const area of REQUIRED_AREAS) {
    const state = areaMap.get(area);
    if (state === undefined) {
      allCertsGO = false;
      record(`certification ${tier} covers area "${area}"`, false);
    } else if (state !== 'PROVEN' && state !== 'N/A') {
      allCertsGO = false;
      record(`certification ${tier} area "${area}" is PROVEN or N/A`, false, `state=${state}`);
    }
  }
}
if (allCertsGO) record('all 5 tier certifications present, GO, fully covered', true);

// 6. convergence audit verdict STRONG
const convergence = readJson(path.join(finalizationRoot, 'convergence-audit.json'));
if (convergence) {
  const allStrong =
    Array.isArray(convergence.axes) &&
    convergence.axes.length >= 8 &&
    convergence.axes.every((a) => a.result === 'STRONG');
  record('convergence audit reports STRONG on all axes', allStrong);
}

// 7. legitimacy audit verdict PASS
const legitimacy = readJson(path.join(finalizationRoot, 'legitimacy-audit.json'));
if (legitimacy) {
  const allPass =
    Array.isArray(legitimacy.audits) &&
    legitimacy.audits.length >= 8 &&
    legitimacy.audits.every((a) => a.verdict === 'PASS');
  record('legitimacy audit reports PASS on every domain', allPass);
}

// 8. proving manifest anchor consistency
const provingManifest = readJson(provingManifestPath);
if (provingManifest) {
  const traversal = provingManifest.traversal?.edges ?? [];
  record(
    'proving manifest carries 4 traversal attestations',
    traversal.length >= 4 && traversal.every((e) => Boolean(e.attestation_id)),
  );
  record(
    'proving manifest carries rollback + restoration attestations',
    Boolean(provingManifest.rollback?.attestation_id) &&
      Boolean(provingManifest.restoration?.attestation_id),
  );
}

// 9. ledger evidence still resolvable for cert anchors
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

const ledgerIds = new Set();
if (fs.existsSync(ledgerRoot)) {
  for (const f of fs.readdirSync(ledgerRoot)) {
    if (!f.endsWith('.jsonl')) continue;
    for (const r of readJsonl(path.join(ledgerRoot, f))) {
      if (r.attestation_id) ledgerIds.add(r.attestation_id);
    }
  }
}
let allAnchorsResolve = true;
for (const tier of REQUIRED_TIERS) {
  const cert = certs[tier];
  if (!cert?.anchors) continue;
  for (const [name, id] of Object.entries(cert.anchors)) {
    if (typeof id !== 'string' || id.length !== 36) continue; // skip non-UUID anchors
    if (!ledgerIds.has(id)) {
      allAnchorsResolve = false;
      record(`cert ${tier} anchor ${name} resolves in ledger`, false, id);
    }
  }
}
if (allAnchorsResolve) record('all certification ledger anchors resolve', true);

// 10. anti-pattern guards across the finalization corpus
const antiPatternBlocklist = ['leaderboard', 'scorecard', 'launch theater', 'metric center'];
const refusalMarkers = ['no ', 'refuse', 'without', 'not:', 'never', 'forbidden', 'prohibits'];
let antiPatternClean = true;
for (const name of REQUIRED_DOCS) {
  const p = path.join(docsRoot, name);
  if (!fs.existsSync(p)) continue;
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.toLowerCase();
    for (const phrase of antiPatternBlocklist) {
      if (!line.includes(phrase)) continue;
      const isRefusal = refusalMarkers.some((m) => line.includes(m));
      if (!isRefusal) {
        antiPatternClean = false;
        record(`anti-pattern "${phrase}" present in ${name} (non-refusal line)`, false, rawLine.trim().slice(0, 80));
      }
    }
  }
}
if (antiPatternClean) record('finalization corpus refuses scoring/leaderboard/launch-theater language', true);

// render
const ok = checks.filter((c) => c.ok).length;
console.log('Final GO status validation');
for (const c of checks) {
  console.log(`  ${c.ok ? 'ok   ' : 'FAIL '} ${c.name}${c.detail ? ' — ' + c.detail : ''}`);
}

if (failed > 0) {
  console.log(`\nNZILA FINAL GO STATUS: NOT CERTIFIED — ${failed} failure(s) (${ok} passing).`);
  process.exit(1);
}

console.log(`\n(${ok} checks passed)`);
console.log('');
console.log('NZILA FINAL GO STATUS: CERTIFIED');
for (const tier of REQUIRED_TIERS) {
  console.log(`${tier.toUpperCase()}: GO`);
}
