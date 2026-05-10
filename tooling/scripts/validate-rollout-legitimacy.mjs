#!/usr/bin/env node
/**
 * Rollout Legitimacy Validator
 *
 * Static checks against governance/foundations/rollout/environments.json and the
 * doctrine corpus under docs/nzila-rollout-governance/.
 *
 * Authority: docs/nzila-rollout-governance/master-rollout-governance-index.md
 *
 * Exit code 0 on all-pass, 1 on any failure.
 */

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const registryPath = path.join(repoRoot, 'governance', 'rollout', 'environments.json');
const docsRoot = path.join(repoRoot, 'docs', 'nzila-rollout-governance');

const REQUIRED_DOCS = [
  'master-rollout-governance-index.md',
  'environment-promotion-governance.md',
  'demo-governance-system.md',
  'pilot-governance-system.md',
  'release-governance-cadence.md',
  'rollout-legitimacy-review-system.md',
  'institutional-onboarding-governance.md',
  'environment-legitimacy-visibility.md',
  'rollout-attestation-fabric.md',
  'operator-rollout-workflows.md',
  'continuity-safe-rollout-system.md',
  'cross-environment-governance-fabric.md',
  'governed-rollback-system.md',
  'rollout-governance-readiness-review.md',
];

const REQUIRED_TIERS = ['local', 'dev', 'staging', 'demo', 'pilot', 'prod'];

const REQUIRED_ENV_FIELDS = [
  'tier',
  'purpose',
  'topology',
  'secret_topology',
  'promotion',
  'attestation_required',
  'snapshot_source',
  'operator_review',
  'rollback_policy',
  'continuity_window_minutes',
];

const failures = [];
const oks = [];

function check(label, fn) {
  try {
    const result = fn();
    if (result === undefined || result === null) {
      oks.push(label);
    } else {
      failures.push(`${label} — ${result}`);
    }
  } catch (e) {
    failures.push(`${label} — ${e.message}`);
  }
}

process.stdout.write('Rollout legitimacy validation\n');

check('environments registry exists', () => {
  if (!fs.existsSync(registryPath)) return 'missing governance/foundations/rollout/environments.json';
});

let registry;
check('environments registry parses', () => {
  registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
});

check('registry advertises authority link', () => {
  if (!registry?.authority?.includes('docs/nzila-rollout-governance/')) {
    return 'authority field must reference docs/nzila-rollout-governance/';
  }
});

check('all required tiers present', () => {
  if (!registry?.environments) return 'no environments map';
  const present = Object.keys(registry.environments);
  const missing = REQUIRED_TIERS.filter((t) => !present.includes(t));
  if (missing.length) return `missing tiers: ${missing.join(', ')}`;
});

check('every environment has required fields', () => {
  for (const tier of REQUIRED_TIERS) {
    const env = registry?.environments?.[tier];
    if (!env) return `${tier} missing`;
    for (const f of REQUIRED_ENV_FIELDS) {
      if (!(f in env)) return `${tier}.${f} missing`;
    }
    if (env.tier !== tier) return `${tier}.tier mismatch (got ${env.tier})`;
  }
});

check('promotion graph is well-formed', () => {
  // Every promotes_to entry must reference a known tier and form a
  // matching promotes_from on the receiving tier.
  for (const tier of REQUIRED_TIERS) {
    const env = registry.environments[tier];
    const to = env.promotion?.promotes_to ?? [];
    for (const target of to) {
      if (!REQUIRED_TIERS.includes(target)) return `${tier} promotes_to unknown tier ${target}`;
      const targetFrom = registry.environments[target]?.promotion?.promotes_from ?? [];
      if (!targetFrom.includes(tier)) {
        return `${target}.promotes_from does not include ${tier}`;
      }
    }
  }
});

check('prod has no promotion target', () => {
  const to = registry.environments.prod?.promotion?.promotes_to ?? [];
  if (to.length) return `prod.promotes_to must be empty (got ${to.join(',')})`;
});

check('prod isolation guaranteed', () => {
  const env = registry.environments.prod;
  if (env.topology !== 'prod-isolated') return `prod.topology must be prod-isolated`;
  if (!String(env.secret_topology).startsWith('per-prod')) {
    return `prod.secret_topology must be per-prod-* (got ${env.secret_topology})`;
  }
});

check('pilot isolation guaranteed', () => {
  const env = registry.environments.pilot;
  if (env.topology !== 'pilot-isolated') return `pilot.topology must be pilot-isolated`;
  if (!String(env.secret_topology).startsWith('per-pilot')) {
    return `pilot.secret_topology must be per-pilot-* (got ${env.secret_topology})`;
  }
});

check('continuity windows monotonic non-decreasing along promotion path', () => {
  const order = ['local', 'dev', 'staging', 'pilot', 'prod'];
  let prev = -1;
  for (const tier of order) {
    const w = registry.environments[tier]?.continuity_window_minutes;
    if (typeof w !== 'number') return `${tier}.continuity_window_minutes not numeric`;
    if (w < prev) return `continuity window regression at ${tier}: ${w} < ${prev}`;
    prev = w;
  }
});

check('all required docs present', () => {
  if (!fs.existsSync(docsRoot)) return 'docs/nzila-rollout-governance/ missing';
  const present = new Set(fs.readdirSync(docsRoot));
  const missing = REQUIRED_DOCS.filter((d) => !present.has(d));
  if (missing.length) return `missing docs: ${missing.join(', ')}`;
});

check('master index references every doc', () => {
  const masterPath = path.join(docsRoot, 'master-rollout-governance-index.md');
  const text = fs.readFileSync(masterPath, 'utf8');
  const missing = REQUIRED_DOCS.filter((d) => d !== 'master-rollout-governance-index.md' && !text.includes(d));
  if (missing.length) return `master index does not reference: ${missing.join(', ')}`;
});

for (const ok of oks) process.stdout.write(`  ok    ${ok}\n`);
for (const f of failures) process.stdout.write(`  FAIL  ${f}\n`);

if (failures.length) {
  process.stdout.write(`\n${failures.length} legitimacy check(s) failed.\n`);
  process.exit(1);
}
process.stdout.write('\nRollout legitimacy: OK.\n');
