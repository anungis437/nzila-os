#!/usr/bin/env node

/**
 * Nzila OS — Runtime Health Status Validator (Delta-3)
 *
 * Reads `reports/runtime/runtime-health-status-latest.json` and enforces the
 * Delta-2/Delta-3 invariants:
 *
 *   1. File exists, is valid JSON, has `summary` with required fields.
 *   2. Every `apps[].currentRuntimeClassification` is in VALID_CLASSIFICATIONS.
 *   3. Every `apps[].evidenceBasis` is in VALID_EVIDENCE.
 *   4. No app may be `healthy` while its evidenceBasis is `live_failure_matrix`
 *      with a DNS-unresolved / timeout / non-2xx live signal.
 *   5. orchestrator-api MUST NOT be classified `healthy` until a post-redeploy
 *      proof artifact under reports/runtime/post-redeploy/ exists.
 *   6. UE pilot MUST NOT be reported as blocked by an `incubating` product;
 *      `blocksUnionEyesPilot=true` is only permitted with policyCritical-bearing
 *      classifications (`fixed_at_source_pending_redeploy` or
 *      `app_readiness_defect` for pilot-critical apps — none today).
 *   7. summary counts MUST match per-app re-tally.
 *
 * Exit codes:
 *   0 — all invariants pass.
 *   1 — at least one invariant violated; details printed to stderr.
 *
 * No live network, no secrets.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  VALID_CLASSIFICATIONS,
  VALID_EVIDENCE,
} from './generate-runtime-health-status.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const LATEST_RELATIVE = 'reports/runtime/runtime-health-status-latest.json';
const FAILURE_MATRIX_RELATIVE = 'reports/runtime/live-health-failure-matrix.json';
const POST_REDEPLOY_DIR = 'reports/runtime/post-redeploy';

const REQUIRED_SUMMARY_FIELDS = [
  'totalAppsReviewed',
  'healthy',
  'degraded',
  'failing',
  'notInstrumented',
  'requiresRedeploy',
  'requiresDnsOrInfra',
  'stagedOrIncubating',
];

const errors = [];

function fail(msg) {
  errors.push(msg);
}

async function readJson(rel) {
  const abs = path.join(repoRoot, rel);
  const raw = await fs.readFile(abs, 'utf8');
  return JSON.parse(raw);
}

async function pathExists(rel) {
  try {
    await fs.access(path.join(repoRoot, rel));
    return true;
  } catch {
    return false;
  }
}

async function postRedeployProofExists(app) {
  try {
    const entries = await fs.readdir(path.join(repoRoot, POST_REDEPLOY_DIR));
    return entries.some(
      (name) => name.toLowerCase().includes(app.toLowerCase()) && name.endsWith('.json'),
    );
  } catch {
    return false;
  }
}

async function main() {
  if (!(await pathExists(LATEST_RELATIVE))) {
    fail(`missing latest status file: ${LATEST_RELATIVE}`);
    return;
  }

  const doc = await readJson(LATEST_RELATIVE);

  if (!doc || typeof doc !== 'object') {
    fail('latest status file is not a JSON object');
    return;
  }
  if (!doc.summary || typeof doc.summary !== 'object') {
    fail('latest status file is missing `summary` object');
    return;
  }
  for (const key of REQUIRED_SUMMARY_FIELDS) {
    if (typeof doc.summary[key] !== 'number') {
      fail(`summary.${key} is missing or not a number`);
    }
  }
  if (!Array.isArray(doc.apps)) {
    fail('latest status file is missing `apps` array');
    return;
  }

  // Failure matrix lookup for healthy-vs-failure cross-check.
  let failureByApp = new Map();
  if (await pathExists(FAILURE_MATRIX_RELATIVE)) {
    const matrix = await readJson(FAILURE_MATRIX_RELATIVE);
    if (Array.isArray(matrix)) {
      for (const entry of matrix) {
        if (!entry || typeof entry.app !== 'string') continue;
        const list = failureByApp.get(entry.app) ?? [];
        list.push(entry);
        failureByApp.set(entry.app, list);
      }
    }
  }

  // Per-app invariants.
  const tally = {
    healthy: 0,
    degraded: 0,
    failing: 0,
    notInstrumented: 0,
    requiresRedeploy: 0,
    requiresDnsOrInfra: 0,
    stagedOrIncubating: 0,
  };

  for (const app of doc.apps) {
    if (!app || typeof app.app !== 'string') {
      fail('apps[] contains entry without `app` string');
      continue;
    }
    if (!VALID_CLASSIFICATIONS.has(app.currentRuntimeClassification)) {
      fail(
        `${app.app}: invalid currentRuntimeClassification "${app.currentRuntimeClassification}"`,
      );
    }
    if (!VALID_EVIDENCE.has(app.evidenceBasis)) {
      fail(`${app.app}: invalid evidenceBasis "${app.evidenceBasis}"`);
    }

    // Invariant 4: cannot be healthy while live failure matrix records a hard failure
    // (DNS unresolved, timeout, or non-2xx final probe).
    if (app.currentRuntimeClassification === 'healthy') {
      const failures = failureByApp.get(app.app) ?? [];
      const hardFailure = failures.find((f) => {
        const status = f.finalStatus ?? f.status ?? f.httpStatus;
        const reason = (f.reason ?? f.failureReason ?? '').toString().toLowerCase();
        if (reason.includes('dns') || reason.includes('timeout')) return true;
        if (typeof status === 'number' && (status < 200 || status >= 300)) return true;
        if (typeof status === 'string' && /^[45]/.test(status)) return true;
        return false;
      });
      if (hardFailure) {
        fail(
          `${app.app}: classified healthy but live-failure-matrix records hard failure ` +
            `(${JSON.stringify(hardFailure)})`,
        );
      }
    }

    // Invariant 5: orchestrator-api gate.
    if (
      app.app === 'orchestrator-api' &&
      app.currentRuntimeClassification === 'healthy'
    ) {
      const proof = await postRedeployProofExists('orchestrator-api');
      if (!proof) {
        fail(
          'orchestrator-api: classified healthy but no post-redeploy proof artifact ' +
            `found under ${POST_REDEPLOY_DIR}/`,
        );
      }
    }

    // Invariant 6: UE pilot gating.
    if (app.blocksUnionEyesPilot === true) {
      const note = (app.notes ?? []).join(' ').toLowerCase();
      if (note.includes('incubating')) {
        fail(
          `${app.app}: blocksUnionEyesPilot=true but notes describe app as incubating ` +
            '(UE pilot must not be blocked by an incubating product)',
        );
      }
    }

    // Tally for invariant 7.
    switch (app.currentRuntimeClassification) {
      case 'healthy':
        tally.healthy += 1;
        break;
      case 'degraded':
        tally.degraded += 1;
        break;
      case 'failing':
        tally.failing += 1;
        break;
      case 'not_instrumented':
        tally.notInstrumented += 1;
        break;
      default:
        break;
    }
    if (app.clearsAfterRedeploy) tally.requiresRedeploy += 1;
    if (app.requiresDnsOrInfra) tally.requiresDnsOrInfra += 1;
    if (
      (app.notes ?? []).some((n) => /staging|incubating/i.test(String(n))) &&
      app.currentRuntimeClassification !== 'healthy'
    ) {
      tally.stagedOrIncubating += 1;
    }
  }

  // Invariant 7: summary counts match per-app re-tally for the four mutually
  // exclusive classifications.
  const sumTotal =
    tally.healthy + tally.degraded + tally.failing + tally.notInstrumented;
  if (doc.summary.totalAppsReviewed !== sumTotal) {
    fail(
      `summary.totalAppsReviewed=${doc.summary.totalAppsReviewed} ` +
        `but per-app tally sums to ${sumTotal}`,
    );
  }
  for (const key of ['healthy', 'degraded', 'failing', 'notInstrumented']) {
    if (doc.summary[key] !== tally[key]) {
      fail(
        `summary.${key}=${doc.summary[key]} but per-app tally counted ${tally[key]}`,
      );
    }
  }
  if (doc.summary.requiresRedeploy !== tally.requiresRedeploy) {
    fail(
      `summary.requiresRedeploy=${doc.summary.requiresRedeploy} ` +
        `but per-app tally counted ${tally.requiresRedeploy}`,
    );
  }
  if (doc.summary.requiresDnsOrInfra !== tally.requiresDnsOrInfra) {
    fail(
      `summary.requiresDnsOrInfra=${doc.summary.requiresDnsOrInfra} ` +
        `but per-app tally counted ${tally.requiresDnsOrInfra}`,
    );
  }
}

const invokedDirectly = (() => {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  main()
    .then(() => {
      if (errors.length > 0) {
        for (const e of errors) console.error(`validate-runtime-health-status: ${e}`);
        console.error(
          `validate-runtime-health-status: FAIL (${errors.length} invariant violation(s))`,
        );
        process.exit(1);
      }
      console.log('validate-runtime-health-status: OK');
    })
    .catch((err) => {
      console.error('validate-runtime-health-status: fatal', err);
      process.exit(1);
    });
}

export { main as validate };
