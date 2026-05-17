#!/usr/bin/env node

/**
 * Nzila OS — Runtime Health Status Generator (Delta-3)
 *
 * Deterministically composes `reports/runtime/runtime-health-status-latest.json`
 * from local evidence sources (no live network, no secrets):
 *
 *   - reports/runtime/live-health-failure-matrix.json   (primary live evidence)
 *   - reports/runtime/runtime-health-status-2026-05-11.json (Delta-2 sidecar)
 *   - governance/release/deployment-inventory.json      (topology + alias metadata)
 *
 * `reports/runtime/health-latest.json` is intentionally NOT consumed as healthy
 * evidence — it is a pure bootstrap artifact whose probes are all `unknown`.
 *
 * Usage:
 *   node tooling/scripts/generate-runtime-health-status.mjs           # write file
 *   node tooling/scripts/generate-runtime-health-status.mjs --check   # CI: fail on drift
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const SOURCE_FILES = {
  failureMatrix: 'reports/runtime/live-health-failure-matrix.json',
  delta2Sidecar: 'reports/runtime/runtime-health-status-2026-05-11.json',
  inventory: 'governance/release/deployment-inventory.json',
};

const OUTPUT_RELATIVE = 'reports/runtime/runtime-health-status-latest.json';
const AS_OF_DATE = '2026-05-11';

/**
 * Apps explicitly classified as out-of-scope for runtime health checks via
 * `outOfScopeForRuntimeChecks: true` in deployment-inventory.json.
 * Listed here for transparency; the generator re-derives this set from the
 * inventory rather than hard-coding membership decisions.
 */
const OUT_OF_SCOPE_INVENTORY_FLAG = 'outOfScopeForRuntimeChecks';

/**
 * faircase is an inventory alias of the `abr` container app
 * (faircase.containerAppName === "nzila-os-abr",
 *  abr.publicProductName === "FairCase"). The generator emits a single
 * canonical entry under `abr` and records the alias in notes.
 */
const ALIAS_MERGE = new Set(['faircase']);

/**
 * Per-app product layer classification (kept here rather than derived because
 * inventory does not encode this dimension uniformly).
 */
const PRODUCT_LAYER = {
  'orchestrator-api': 'infrastructure',
  'control-plane': 'infrastructure',
  'union-eyes': 'product',
  flow: 'product',
  partners: 'product',
  cfo: 'product',
  zonga: 'product',
  agrimo: 'product',
  cora: 'product',
  trade: 'product',
  mobility: 'product',
  abr: 'product',
  'veridian-site': 'product',
  'veridian-care': 'product',
  'veridian-admin': 'product',
  'nacp-exams': 'product',
  'mobility-client-portal': 'product',
  web: 'platform',
  console: 'internal',
  'platform-admin': 'internal',
};

const VALID_CLASSIFICATIONS = new Set(['healthy', 'degraded', 'failing', 'not_instrumented']);
const VALID_EVIDENCE = new Set([
  'live_failure_matrix',
  'health_latest',
  'inventory',
  'manual_delta_2_report',
]);

async function readJson(rel) {
  const abs = path.join(repoRoot, rel);
  const raw = await fs.readFile(abs, 'utf8');
  return JSON.parse(raw);
}

function indexFailuresByApp(matrix) {
  const out = new Map();
  for (const entry of matrix) {
    const list = out.get(entry.app) ?? [];
    list.push(entry);
    out.set(entry.app, list);
  }
  return out;
}

function classifyApp(app, ctx) {
  const { failures, sidecar, inventoryEntry } = ctx;
  const sidecarEntry = sidecar.apps.find((a) => a.key === app);
  const notes = [];

  // Out-of-scope apps are filtered before reaching here.

  if (app === 'orchestrator-api') {
    notes.push(
      'Three ACA fallback failures (root, health, ready) recorded in live-health-failure-matrix.json.',
      'Source fix shipped in commit 4ad83815f (apps/orchestrator-api/src/routes/health.ts critical/non-critical split).',
      'Classification clears to `healthy` only after post-redeploy ACA probe re-test (see post-delta-2-redeploy-proof-plan-2026-05-11.md).',
    );
    return {
      currentRuntimeClassification: 'failing',
      evidenceBasis: 'live_failure_matrix',
      clearsAfterRedeploy: true,
      requiresDnsOrInfra: false,
      blocksUnionEyesPilot: false,
      notes,
    };
  }

  if (sidecarEntry?.classification === 'staged_not_resolvable') {
    notes.push(
      'DNS lookup failed for staging custom domain; no ACA app deployed (synthetic demo profile).',
      'Not blocking Union Eyes pilot — Veridian is staged-only and does not host PHI.',
    );
    return {
      currentRuntimeClassification: 'not_instrumented',
      evidenceBasis: 'live_failure_matrix',
      clearsAfterRedeploy: false,
      requiresDnsOrInfra: true,
      blocksUnionEyesPilot: false,
      notes,
    };
  }

  if (sidecarEntry?.classification === 'app_readiness_defect') {
    notes.push(
      'Fallback ACA `/api/health` returns HTTP 503 in live-health-failure-matrix.json.',
      'App is incubating (tier-2 staging-only) and is NOT a Union Eyes pilot dependency.',
      'Adopting `@nzila/os-core/health` helper will reclassify to `degraded`/`healthy`.',
    );
    return {
      currentRuntimeClassification: 'failing',
      evidenceBasis: 'live_failure_matrix',
      clearsAfterRedeploy: false,
      requiresDnsOrInfra: false,
      blocksUnionEyesPilot: false,
      notes,
    };
  }

  if (sidecarEntry?.classification === 'advisory_fallback_ingress_timeout') {
    notes.push(
      'Only the advisory root probe timed out; `/api/health` did not fail.',
      'Treated as `degraded` (HTTP 200 retained) per RuntimeHealthResponse `ok` semantics.',
    );
    return {
      currentRuntimeClassification: 'degraded',
      evidenceBasis: 'live_failure_matrix',
      clearsAfterRedeploy: false,
      requiresDnsOrInfra: false,
      blocksUnionEyesPilot: false,
      notes,
    };
  }

  if (sidecarEntry?.classification === 'custom_domain_advisory') {
    notes.push(
      'Custom domain probe failed; ACA fallback domain healthy.',
      'Advisory only — runtime classification remains `healthy` per dual-status helper.',
    );
    return {
      currentRuntimeClassification: 'healthy',
      evidenceBasis: 'live_failure_matrix',
      clearsAfterRedeploy: false,
      requiresDnsOrInfra: false,
      blocksUnionEyesPilot: false,
      notes,
    };
  }

  // No live failures + no Delta-2 sidecar entry → fall back to inventory.
  // Inventory schema (validated against governance/release/deployment-inventory.json):
  //   releaseStatus: prod-approved | internal-only | staging-only | incubating | blocked
  //                  | frozen | deprecated | not-deployed
  //   stagingDnsStatus: active | pending-manual-cloudflare | not-deployed
  //   productionDnsStatus: active | (absent)
  //   routing.production: <url> | 'blocked'
  //   routing.staging: <url> | 'blocked'
  const releaseStatus = inventoryEntry?.releaseStatus ?? 'unknown';
  const productionLive =
    typeof inventoryEntry?.routing?.production === 'string' &&
    inventoryEntry.routing.production.startsWith('https://');
  const productionDnsActive = inventoryEntry?.productionDnsStatus === 'active';
  const stagingDnsActive = inventoryEntry?.stagingDnsStatus === 'active';

  // Frozen / deprecated / not-deployed: never instrumented at runtime.
  if (
    releaseStatus === 'frozen' ||
    releaseStatus === 'deprecated' ||
    releaseStatus === 'not-deployed'
  ) {
    notes.push(
      `Inventory: releaseStatus=${releaseStatus}; not instrumented for runtime health.`,
    );
    return {
      currentRuntimeClassification: 'not_instrumented',
      evidenceBasis: 'inventory',
      clearsAfterRedeploy: false,
      requiresDnsOrInfra: false,
      blocksUnionEyesPilot: false,
      notes,
    };
  }

  // Blocked apps with no live failures and no sidecar: classify as not_instrumented
  // — we have no positive evidence of runtime health, only that promotion is blocked.
  if (releaseStatus === 'blocked') {
    notes.push('Inventory: releaseStatus=blocked; no live runtime evidence available.');
    return {
      currentRuntimeClassification: 'not_instrumented',
      evidenceBasis: 'inventory',
      clearsAfterRedeploy: false,
      requiresDnsOrInfra: false,
      blocksUnionEyesPilot: false,
      notes,
    };
  }

  // prod-approved or internal-only apps with no failures and live ingress
  // (production routing OR active DNS) → healthy via inventory.
  if (
    failures.length === 0 &&
    (releaseStatus === 'prod-approved' || releaseStatus === 'internal-only') &&
    (productionLive || productionDnsActive || stagingDnsActive)
  ) {
    notes.push(
      `Inventory: releaseStatus=${releaseStatus} with live ingress; no failure-matrix entries.`,
    );
    return {
      currentRuntimeClassification: 'healthy',
      evidenceBasis: 'inventory',
      clearsAfterRedeploy: false,
      requiresDnsOrInfra: false,
      blocksUnionEyesPilot: false,
      notes,
    };
  }

  // staging-only / incubating with no failures and no sidecar entry: we have
  // no positive runtime evidence — refuse to claim healthy.
  notes.push(
    `Inventory: releaseStatus=${releaseStatus}; no live failures recorded but no positive runtime evidence either.`,
  );
  return {
    currentRuntimeClassification: 'not_instrumented',
    evidenceBasis: 'inventory',
    clearsAfterRedeploy: false,
    requiresDnsOrInfra: false,
    blocksUnionEyesPilot: false,
    notes,
  };
}

function buildAppEntry(app, ctx) {
  const layer = PRODUCT_LAYER[app];
  if (!layer) {
    throw new Error(
      `generate-runtime-health-status: app '${app}' has no PRODUCT_LAYER mapping; update the generator.`,
    );
  }
  const classification = classifyApp(app, ctx);
  const aliasNotes = [];
  if (app === 'abr') {
    aliasNotes.push(
      'Public product name: FairCase (deployment-inventory.json `faircase` is an alias of this container).',
    );
  }
  return {
    app,
    productLayer: layer,
    ...classification,
    notes: [...aliasNotes, ...classification.notes],
  };
}

function summarize(apps) {
  const summary = {
    totalAppsReviewed: apps.length,
    healthy: 0,
    degraded: 0,
    failing: 0,
    notInstrumented: 0,
    requiresRedeploy: 0,
    requiresDnsOrInfra: 0,
    stagedOrIncubating: 0,
  };
  for (const a of apps) {
    if (a.currentRuntimeClassification === 'healthy') summary.healthy += 1;
    if (a.currentRuntimeClassification === 'degraded') summary.degraded += 1;
    if (a.currentRuntimeClassification === 'failing') summary.failing += 1;
    if (a.currentRuntimeClassification === 'not_instrumented') summary.notInstrumented += 1;
    if (a.clearsAfterRedeploy) summary.requiresRedeploy += 1;
    if (a.requiresDnsOrInfra) summary.requiresDnsOrInfra += 1;
    if (
      a.currentRuntimeClassification === 'failing' &&
      a.notes.some((n) => /incubating/i.test(n))
    ) {
      summary.stagedOrIncubating += 1;
    }
  }
  return summary;
}

async function build() {
  const [matrix, sidecar, inventory] = await Promise.all([
    readJson(SOURCE_FILES.failureMatrix),
    readJson(SOURCE_FILES.delta2Sidecar),
    readJson(SOURCE_FILES.inventory),
  ]);

  const failuresByApp = indexFailuresByApp(matrix);

  const inventoryApps = inventory.apps ?? {};
  const eligibleAppKeys = Object.entries(inventoryApps)
    .filter(([key, entry]) => !entry?.[OUT_OF_SCOPE_INVENTORY_FLAG] && !ALIAS_MERGE.has(key))
    .map(([key]) => key)
    .sort();

  const apps = eligibleAppKeys.map((app) =>
    buildAppEntry(app, {
      failures: failuresByApp.get(app) ?? [],
      sidecar,
      inventoryEntry: inventoryApps[app],
    }),
  );

  const document = {
    asOfDate: AS_OF_DATE,
    scope: 'portfolio-runtime-health',
    authorityLevel: 'current-runtime-remediation',
    sourceFiles: Object.values(SOURCE_FILES).sort(),
    summary: summarize(apps),
    apps,
  };

  return document;
}

function stableStringify(obj) {
  return `${JSON.stringify(obj, null, 2)}\n`;
}

async function main() {
  const checkMode = process.argv.includes('--check');
  const document = await build();
  const serialized = stableStringify(document);
  const outputAbs = path.join(repoRoot, OUTPUT_RELATIVE);

  if (checkMode) {
    let existing;
    try {
      existing = await fs.readFile(outputAbs, 'utf8');
    } catch (err) {
      console.error(`generate-runtime-health-status --check: missing ${OUTPUT_RELATIVE}`);
      console.error(`Run: pnpm runtime:health:generate`);
      process.exit(1);
    }
    if (existing !== serialized) {
      console.error(
        `generate-runtime-health-status --check: drift detected in ${OUTPUT_RELATIVE}.`,
      );
      console.error('Run `pnpm runtime:health:generate` and commit the regenerated file.');
      process.exit(1);
    }
    console.log(`generate-runtime-health-status --check: ${OUTPUT_RELATIVE} is up to date.`);
    return;
  }

  await fs.mkdir(path.dirname(outputAbs), { recursive: true });
  await fs.writeFile(outputAbs, serialized, 'utf8');
  console.log(`generate-runtime-health-status: wrote ${OUTPUT_RELATIVE}`);
  console.log(`  apps: ${document.summary.totalAppsReviewed}`);
  console.log(
    `  healthy=${document.summary.healthy} degraded=${document.summary.degraded} failing=${document.summary.failing} not_instrumented=${document.summary.notInstrumented}`,
  );
}

export { build, classifyApp, summarize, VALID_CLASSIFICATIONS, VALID_EVIDENCE };

const invokedDirectly = (() => {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  main().catch((err) => {
    console.error('generate-runtime-health-status: fatal', err);
    process.exit(1);
  });
}
