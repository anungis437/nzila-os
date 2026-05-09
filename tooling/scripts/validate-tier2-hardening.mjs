#!/usr/bin/env node

/**
 * Nzila OS — Tier 2 Hardening Validator
 *
 * Doctrine anchor: docs/nzila-tier2-hardening/README.md
 *
 * Enforces:
 *  - all required Tier 2 hardening docs exist
 *  - fail-closed architecture enumerates the canonical contracts
 *  - secret sovereignty doc enumerates the canonical KV authority + bindings
 *  - runtime mode doc enumerates the canonical mode lineage
 *  - pilot fabric doc enumerates the canonical pilot resources
 *  - identity isolation doc enumerates the canonical identity surfaces
 *  - workspace sovereignty doc enumerates the canonical determinism contract
 *  - degradation certification doc enumerates each degradation cell
 *  - sovereignty certification doc carries per-environment verdicts
 *  - fail-closed runtime gate is present and wired into instrumentation
 *  - required tone signals distributed across the layer
 *  - forbidden framings only inside negated/forbidden contexts
 *  - validator script registered in root package.json
 *
 * Authority style: substrate hardening, not feature plumbing.  Continuity-safe,
 * governance-safe, anti-surveillance, evidence-anchored, stewardship cadence.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const layerRoot = path.join(repoRoot, 'docs', 'nzila-tier2-hardening');
const failClosedSrc = path.join(repoRoot, 'apps', 'union-eyes', 'lib', 'runtime', 'fail-closed.ts');
const instrumentation = path.join(repoRoot, 'apps', 'union-eyes', 'instrumentation.ts');
const rootPackageJson = path.join(repoRoot, 'package.json');

const requiredDocs = [
  'README.md',
  'full-fail-closed-runtime-architecture.md',
  'full-secret-topology-sovereignty.md',
  'full-runtime-mode-feature-sovereignty-hardening.md',
  'full-pilot-fabric-legitimacy.md',
  'full-auth-identity-isolation-hardening.md',
  'full-workspace-substrate-sovereignty.md',
  'full-live-operational-degradation-certification.md',
  'full-live-runtime-sovereignty-certification.md',
];

const requiredFailClosedContracts = [
  'auth.next.secret',
  'auth.django.secret',
  'auth.webhook.secret',
  'crypto.fallback',
  'crypto.pii',
  'identity.entra.client_id',
  'identity.entra.tenant_id',
  'identity.entra.client_secret',
  'data.database_url',
  'lineage.secret_topology',
  'lineage.secret_authority',
  'lineage.environment_isolation',
];

const requiredSecretSovereigntyAnchors = [
  'nzila-canada-demo-kv',
  'nzila-staging-kv',
  'secret_topology',
  'secret_authority',
  'environment_isolation',
  'sovereign secret identity',
  'sovereign secret lineage',
  'sovereign runtime bindings',
];

const requiredModeAnchors = [
  'nzila_mode',
  'deterministic resolution',
  'governance-safe fallback',
  'invalid mode handling',
  'fail-closed mode behavior',
  'cognition gating',
  'governance gating',
  'continuity gating',
  'onboarding gating',
  'executive gating',
];

const requiredPilotResources = [
  'nzila-canada-pilot-rg',
  'nzila-canada-pilot-env',
  'nzila-os-union-eyes-pilot',
  'nzila-canada-pilot-kv',
  'nzila-canada-pilot-db',
  'pilot.unioneyes.app',
];

const requiredIdentitySurfaces = [
  'auth()',
  'getorganizationidforuser',
  'auth_user_sessions',
  'organization_members',
  'auth_organization_users',
  'nzila_session',
  'selected_org_id',
  'default_organization_id',
];

const requiredWorkspaceAnchors = [
  'pnpm-workspace.yaml',
  'pnpm-lock.yaml',
  'turbopack',
  'tsc',
  'vitest',
  'docker',
  'lockfile parity',
  'per-package vitest config',
];

const requiredDegradationCells = [
  'missing env vars',
  'disabled cognition',
  'auth degradation',
  'governance degradation',
  'notification degradation',
  'telemetry degradation',
  'continuity degradation',
  'secret resolution failure',
];

const requiredEnvironments = ['dev', 'staging', 'demo', 'pilot'];
const requiredVerdicts = ['go', 'conditional go', 'no-go'];

const requiredToneSignals = [
  'institutional',
  'continuity',
  'governance-safe',
  'continuity-safe',
  'anti-surveillance',
  'stewardship',
  'cadence',
  'reviewer-of-record',
  'evidence-anchored',
  'maturity',
  'operational',
  'embodied',
  'inevitable',
  'singular',
  'calm',
];

const forbiddenFramings = [
  'ai-first',
  'ai-powered',
  'copilot',
  'chatbot',
  'workforce ai',
  'productivity optimization',
  'autonomous executive',
  'ai ceo',
  'ai assistant',
  'engagement gamification',
];

const requiredScripts = [
  'validate:runtime-integrity',
  'validate:tier2-hardening',
];

async function readText(filePath) {
  return fs.readFile(filePath, 'utf8');
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function rel(p) {
  return path.relative(repoRoot, p).replaceAll('\\', '/');
}

async function checkDoc(docName, requiredAnchors, label) {
  const errors = [];
  const docPath = path.join(layerRoot, docName);
  if (!(await exists(docPath))) return errors;
  const lower = (await readText(docPath)).toLowerCase();
  const missing = requiredAnchors.filter((a) => !lower.includes(a.toLowerCase()));
  if (missing.length > 0) {
    errors.push(`${label} doc missing required anchors:\n- ${missing.join('\n- ')}`);
  }
  return errors;
}

async function main() {
  const errors = [];

  // ── 1. Required hardening docs exist ─────────────────────────────
  const docPaths = [];
  const missingDocs = [];
  for (const name of requiredDocs) {
    const full = path.join(layerRoot, name);
    if (!(await exists(full))) {
      missingDocs.push(rel(full));
      continue;
    }
    docPaths.push(full);
  }
  if (missingDocs.length > 0) {
    errors.push(`Missing required Tier 2 hardening docs:\n- ${missingDocs.join('\n- ')}`);
  }

  // ── 2..8. Per-doc anchor checks ──────────────────────────────────
  errors.push(...(await checkDoc('full-fail-closed-runtime-architecture.md', requiredFailClosedContracts, 'Fail-closed architecture')));
  errors.push(...(await checkDoc('full-secret-topology-sovereignty.md', requiredSecretSovereigntyAnchors, 'Secret topology sovereignty')));
  errors.push(...(await checkDoc('full-runtime-mode-feature-sovereignty-hardening.md', requiredModeAnchors, 'Runtime mode sovereignty')));
  errors.push(...(await checkDoc('full-pilot-fabric-legitimacy.md', requiredPilotResources, 'Pilot fabric legitimacy')));
  errors.push(...(await checkDoc('full-auth-identity-isolation-hardening.md', requiredIdentitySurfaces, 'Auth identity isolation')));
  errors.push(...(await checkDoc('full-workspace-substrate-sovereignty.md', requiredWorkspaceAnchors, 'Workspace substrate sovereignty')));
  errors.push(...(await checkDoc('full-live-operational-degradation-certification.md', requiredDegradationCells, 'Operational degradation certification')));

  // ── 9. Sovereignty certification carries per-env verdicts ────────
  const certPath = path.join(layerRoot, 'full-live-runtime-sovereignty-certification.md');
  if (await exists(certPath)) {
    const lower = (await readText(certPath)).toLowerCase();
    const missingEnv = requiredEnvironments.filter((e) => !lower.includes(e));
    if (missingEnv.length > 0) {
      errors.push(`Sovereignty certification missing environments:\n- ${missingEnv.join('\n- ')}`);
    }
    const missingVerdicts = requiredVerdicts.filter((v) => !lower.includes(v));
    if (missingVerdicts.length > 0) {
      errors.push(`Sovereignty certification missing verdict vocabulary:\n- ${missingVerdicts.join('\n- ')}`);
    }
  }

  // ── 10. Fail-closed gate present and wired ───────────────────────
  if (!(await exists(failClosedSrc))) {
    errors.push(`Fail-closed runtime gate missing: ${rel(failClosedSrc)}`);
  } else {
    const src = (await readText(failClosedSrc)).toLowerCase();
    const wantSymbols = ['enforceruntimefailclosed', 'assessruntimecontracts', 'runtimecontracterror'];
    const missing = wantSymbols.filter((s) => !src.includes(s));
    if (missing.length > 0) {
      errors.push(`Fail-closed gate source missing symbols:\n- ${missing.join('\n- ')}`);
    }
    for (const k of requiredFailClosedContracts) {
      if (!src.includes(k)) {
        errors.push(`Fail-closed gate source missing contract key: ${k}`);
      }
    }
  }
  if (await exists(instrumentation)) {
    const inst = await readText(instrumentation);
    if (!inst.includes('enforceRuntimeFailClosed')) {
      errors.push('instrumentation.ts does not wire enforceRuntimeFailClosed.');
    }
    if (!inst.includes('./lib/runtime/fail-closed')) {
      errors.push('instrumentation.ts does not import the fail-closed module.');
    }
  } else {
    errors.push('apps/union-eyes/instrumentation.ts is missing.');
  }

  // ── 11. Required tone signals distributed across the layer ───────
  const joinedLower = (await Promise.all(docPaths.map(readText))).join('\n\n').toLowerCase();
  const missingTone = requiredToneSignals.filter((s) => !joinedLower.includes(s));
  if (missingTone.length > 0) {
    errors.push(`Required tone signals missing across Tier 2 hardening layer:\n- ${missingTone.join('\n- ')}`);
  }

  // ── 12. Forbidden framings must be negated or absent ─────────────
  const negationPattern = /(\bnot\b|avoid|forbidden|reject|rejected|without|never|absent|prohibit|anti-|disallow|excluded|enumerated|drift|incompatible|deprecate|removed|eliminate|rebadged|folded|mis-categor|competitor|legacy|objection|do not|don't|must not|no longer|dead|old|bad|skipping|toward)/;
  const forbiddenHits = [];
  for (const phrase of forbiddenFramings) {
    let idx = joinedLower.indexOf(phrase);
    while (idx !== -1) {
      const before = joinedLower.slice(Math.max(0, idx - 800), idx);
      const after = joinedLower.slice(idx + phrase.length, idx + phrase.length + 400);
      const negated = negationPattern.test(before) || negationPattern.test(after);
      if (!negated) {
        forbiddenHits.push(`"${phrase}" near offset ${idx}`);
        break;
      }
      idx = joinedLower.indexOf(phrase, idx + phrase.length);
    }
  }
  if (forbiddenHits.length > 0) {
    errors.push(`Forbidden framings appear unbounded in Tier 2 hardening layer:\n- ${forbiddenHits.join('\n- ')}`);
  }

  // ── 13. Validator scripts registered in root package.json ────────
  if (await exists(rootPackageJson)) {
    const pkgRaw = await readText(rootPackageJson);
    let pkg;
    try {
      pkg = JSON.parse(pkgRaw);
    } catch (err) {
      errors.push(`Could not parse root package.json: ${err instanceof Error ? err.message : String(err)}`);
      pkg = null;
    }
    if (pkg && typeof pkg === 'object') {
      const scripts = pkg.scripts ?? {};
      const missingScripts = requiredScripts.filter((s) => !(s in scripts));
      if (missingScripts.length > 0) {
        errors.push(`Required validator scripts missing in root package.json:\n- ${missingScripts.join('\n- ')}`);
      }
    }
  } else {
    errors.push('Root package.json is missing.');
  }

  if (errors.length > 0) {
    console.error('\nTier 2 hardening validation FAILED.\n');
    for (const err of errors) console.error(`- ${err}\n`);
    process.exit(1);
  }

  console.log('Tier 2 hardening validation passed.');
  console.log(`Validated docs: ${docPaths.length}`);
  console.log(`Validated fail-closed contracts: ${requiredFailClosedContracts.length}`);
  console.log(`Validated required scripts: ${requiredScripts.length}`);
}

main().catch((error) => {
  console.error('Tier 2 hardening validator crashed:', error);
  process.exit(1);
});
