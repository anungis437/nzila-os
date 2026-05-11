#!/usr/bin/env node
/**
 * Field Operations Legitimacy Validator
 *
 * Static checks against the field operations doctrine corpus under
 * docs/nzila-field-operations/ and the cadence/audit substrate.
 *
 * Authority: docs/nzila-field-operations/master-field-operations-index.md
 *
 * Exit code 0 on all-pass, 1 on any failure.
 */

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const docsRoot = path.join(repoRoot, 'docs', 'nzila-field-operations');
const masterIndex = path.join(docsRoot, 'master-field-operations-index.md');

const REQUIRED_DOCS = [
  'master-field-operations-index.md',
  'institutional-field-operations-framework.md',
  'pilot-execution-discipline.md',
  'operator-cadence-system.md',
  'governance-review-cadence.md',
  'executive-briefing-rhythm.md',
  'onboarding-governance-operations.md',
  'environment-lifecycle-governance.md',
  'stabilization-operations-system.md',
  'live-operational-readiness-system.md',
  'field-operations-workflow-fabric.md',
  'operational-rehearsal-governance.md',
  'cross-app-field-operations-consistency.md',
  'operational-legitimacy-audit-system.md',
  'field-operations-readiness-review.md',
];

const REQUIRED_AUTHORITY_PHRASE = 'master-field-operations-index.md';

const checks = [];
let failed = 0;

function record(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  if (!ok) failed++;
}

// 1. corpus presence
let allDocsPresent = true;
for (const name of REQUIRED_DOCS) {
  if (!fs.existsSync(path.join(docsRoot, name))) {
    allDocsPresent = false;
    record(`required doc present: ${name}`, false);
  }
}
if (allDocsPresent) record('all required field-ops docs present', true);

// 2. master index references every doc
if (fs.existsSync(masterIndex)) {
  const indexBody = fs.readFileSync(masterIndex, 'utf8');
  let allLinked = true;
  for (const name of REQUIRED_DOCS) {
    if (name === 'master-field-operations-index.md') continue;
    if (!indexBody.includes(name)) {
      allLinked = false;
      record(`master index references ${name}`, false);
    }
  }
  if (allLinked) record('master index references every doc', true);
} else {
  record('master index exists', false);
}

// 3. every non-index doc cites the master index as authority
let allCiteAuthority = true;
for (const name of REQUIRED_DOCS) {
  if (name === 'master-field-operations-index.md') continue;
  const p = path.join(docsRoot, name);
  if (!fs.existsSync(p)) continue;
  const body = fs.readFileSync(p, 'utf8');
  if (!body.includes(REQUIRED_AUTHORITY_PHRASE)) {
    allCiteAuthority = false;
    record(`authority cited in ${name}`, false);
  }
}
if (allCiteAuthority) record('every doc cites the master index as authority', true);

// 4. every doc has a Status header
let allHaveStatus = true;
for (const name of REQUIRED_DOCS) {
  const p = path.join(docsRoot, name);
  if (!fs.existsSync(p)) continue;
  const body = fs.readFileSync(p, 'utf8');
  if (!/^\*\*Status:\*\*\s+\w+/m.test(body) && !body.includes('Authority root:')) {
    allHaveStatus = false;
    record(`status header in ${name}`, false);
  }
}
if (allHaveStatus) record('every doc has a status header', true);

// 5. companion layer linkage
const masterBody = fs.existsSync(masterIndex) ? fs.readFileSync(masterIndex, 'utf8') : '';
record(
  'master index references rollout governance corpus',
  masterBody.includes('nzila-rollout-governance/master-rollout-governance-index.md'),
);

// 6. anti-pattern guard: no "score" gamification language in readiness or audit docs
const antiPatternGuard = (file, forbidden) => {
  const p = path.join(docsRoot, file);
  if (!fs.existsSync(p)) return true;
  const body = fs.readFileSync(p, 'utf8').toLowerCase();
  for (const phrase of forbidden) {
    // permit the term when accompanied by a refusal posture sentence
    if (
      body.includes(phrase) &&
      !body.includes('no readiness scores') &&
      !body.includes('refuses') &&
      !body.includes('no numeric')
    ) {
      return false;
    }
  }
  return true;
};
record(
  'readiness doc refuses score gamification',
  antiPatternGuard('live-operational-readiness-system.md', ['leaderboard']),
);
record(
  'audit doc refuses operator scorecards',
  antiPatternGuard('operational-legitimacy-audit-system.md', ['per-operator scorecard']),
);

// render
console.log('Field operations legitimacy validation');
for (const c of checks) {
  console.log(`  ${c.ok ? 'ok   ' : 'FAIL '} ${c.name}${c.detail ? ' — ' + c.detail : ''}`);
}
if (failed > 0) {
  console.log(`\nField operations legitimacy: ${failed} failure(s).`);
  process.exit(1);
}
console.log('\nField operations legitimacy: OK.');
