#!/usr/bin/env node

/**
 * Nzila OS — Sovereignty Proving Validator
 *
 * Doctrine anchor: docs/nzila-sovereignty-proving/README.md
 *
 * Enforces:
 *  - all required sovereignty proving docs exist
 *  - degradation traversal enumerates the canonical cells + environments
 *  - fail-closed proof enumerates the canonical contract keys
 *  - operational honesty certification carries the forbidden-framing inventory
 *  - cognition degradation governance enumerates the canonical degradation cells
 *  - auth identity stress validation carries the canonical surfaces + envs
 *  - continuity-safe operations proving carries the canonical preservation cells
 *  - sovereignty traversal e2e carries per-environment substrate evidence
 *  - tier2 operational review carries per-environment verdicts + residual register
 *  - required tone signals distributed across the layer
 *  - forbidden framings only inside negated/forbidden contexts
 *  - validator script registered in root package.json
 *
 * Authority style: stewardship cadence, not feature plumbing. Continuity-safe,
 * governance-safe, anti-surveillance, evidence-anchored.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const layerRoot = path.join(repoRoot, 'docs', 'nzila-sovereignty-proving');
const rootPackageJson = path.join(repoRoot, 'package.json');

const requiredDocs = [
  'README.md',
  'full-live-degradation-traversal-program.md',
  'full-fail-closed-runtime-proof.md',
  'full-operational-honesty-certification.md',
  'full-cognition-degradation-governance.md',
  'full-auth-identity-stress-validation.md',
  'full-continuity-safe-operations-proving.md',
  'full-live-sovereignty-traversal-e2e.md',
  'full-tier2-operational-sovereignty-review.md',
];

const requiredEnvironments = ['dev', 'staging', 'demo', 'pilot'];
const requiredVerdicts = ['go', 'conditional go', 'no-go'];

const requiredDegradationCells = [
  'missing env vars',
  'cognition disablement',
  'secret resolution failure',
  'telemetry degradation',
  'governance degradation',
  'notification degradation',
  'auth degradation',
  'continuity substrate degradation',
  'db unavailability',
  'external provider degradation',
  'partial service collapse',
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

const requiredCognitionCells = [
  'openai unavailable',
  'provider timeout',
  'malformed cognition response',
  'incomplete evidence',
  'missing governance context',
  'missing continuity lineage',
  'cognition disablement',
  'reviewer-of-record',
  'bounded cognition fallback',
  'governance-safe interpretation fallback',
  'operational interpretation suppression',
];

const requiredAuthSurfaces = [
  'expired sessions',
  'invalid org cookies',
  'role mismatch',
  'partial auth state',
  'org-switch degradation',
  'seeded-persona degradation',
  'locale redirect degradation',
  'auth provider degradation',
  'auth_user_sessions',
  'organization_members',
  'getorganizationidforuser',
];

const requiredContinuityCells = [
  'steward transitions',
  'onboarding continuity',
  'governance review continuity',
  'operational memory',
  'cadence continuity',
  'operational recovery',
  'continuity preservation',
  'institutional memory',
  'governance lineage preservation',
  'operational boundedness',
];

const requiredTraversalAnchors = [
  'onboarding',
  'auth',
  'role redirect',
  'governance review',
  'continuity review',
  'cognition review',
  'executive walkthrough',
  'procurement walkthrough',
  'degraded cognition',
  'degraded auth',
  'degraded governance',
  'degraded continuity',
  'operational recovery',
  'nzila-canada-pilot-rg',
  'demo.unioneyes.app',
  'pilot.unioneyes.app',
];

const requiredHonestyAnchors = [
  'inflated readiness language',
  'hidden degraded states',
  'ambiguous runtime states',
  'misleading operational posture',
  'symbolic go',
  'runtime banners',
  'fallback states',
  'degraded cognition messaging',
  'operational warnings',
  'governance notices',
  'continuity warnings',
  'operational readiness notices',
  'runtime certification wording',
];

const requiredReviewAnchors = [
  'fail-closed verdict',
  'degradation verdict',
  'cognition governance verdict',
  'auth integrity verdict',
  'continuity integrity verdict',
  'operational honesty verdict',
  'sovereign environment verdict',
  'residual',
  'tier 3 readiness',
  'terminal verdict',
];

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
  'bounded',
  'deterministic',
  'honest',
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
  'validate:sovereignty-proving',
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

  // ── 1. Required proving docs exist ───────────────────────────────
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
    errors.push(`Missing required sovereignty proving docs:\n- ${missingDocs.join('\n- ')}`);
  }

  // ── 2..8. Per-doc anchor checks ──────────────────────────────────
  errors.push(...(await checkDoc('full-live-degradation-traversal-program.md', requiredDegradationCells, 'Live degradation traversal program')));
  errors.push(...(await checkDoc('full-fail-closed-runtime-proof.md', requiredFailClosedContracts, 'Fail-closed runtime proof')));
  errors.push(...(await checkDoc('full-operational-honesty-certification.md', requiredHonestyAnchors, 'Operational honesty certification')));
  errors.push(...(await checkDoc('full-cognition-degradation-governance.md', requiredCognitionCells, 'Cognition degradation governance')));
  errors.push(...(await checkDoc('full-auth-identity-stress-validation.md', requiredAuthSurfaces, 'Auth identity stress validation')));
  errors.push(...(await checkDoc('full-continuity-safe-operations-proving.md', requiredContinuityCells, 'Continuity-safe operations proving')));
  errors.push(...(await checkDoc('full-live-sovereignty-traversal-e2e.md', requiredTraversalAnchors, 'Live sovereignty traversal E2E')));
  errors.push(...(await checkDoc('full-tier2-operational-sovereignty-review.md', requiredReviewAnchors, 'Tier 2 operational sovereignty review')));

  // ── 9. Per-environment + verdict vocabulary across the layer ─────
  const joinedLower = (await Promise.all(docPaths.map(readText))).join('\n\n').toLowerCase();
  const missingEnv = requiredEnvironments.filter((e) => !joinedLower.includes(e));
  if (missingEnv.length > 0) {
    errors.push(`Sovereignty proving layer missing environments:\n- ${missingEnv.join('\n- ')}`);
  }
  const missingVerdicts = requiredVerdicts.filter((v) => !joinedLower.includes(v));
  if (missingVerdicts.length > 0) {
    errors.push(`Sovereignty proving layer missing verdict vocabulary:\n- ${missingVerdicts.join('\n- ')}`);
  }

  // ── 10. Required tone signals ────────────────────────────────────
  const missingTone = requiredToneSignals.filter((s) => !joinedLower.includes(s));
  if (missingTone.length > 0) {
    errors.push(`Required tone signals missing across sovereignty proving layer:\n- ${missingTone.join('\n- ')}`);
  }

  // ── 11. Forbidden framings only inside negated context ───────────
  const negationPattern = /(\bnot\b|avoid|forbidden|reject|rejected|without|never|absent|prohibit|anti-|disallow|excluded|enumerated|drift|incompatible|deprecate|removed|eliminate|rebadged|folded|mis-categor|competitor|legacy|objection|do not|don't|must not|no longer|dead|old|bad|skipping|toward|silent|fabricat|hallucinat|inflated|symbolic)/;
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
    errors.push(`Forbidden framings appear unbounded in sovereignty proving layer:\n- ${forbiddenHits.join('\n- ')}`);
  }

  // ── 12. Validator scripts registered ─────────────────────────────
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
    console.error('\nSovereignty proving validation FAILED.\n');
    for (const err of errors) console.error(`- ${err}\n`);
    process.exit(1);
  }

  console.log(
    `Sovereignty proving validation PASSED.\n` +
      `  ${requiredDocs.length} proving docs present\n` +
      `  ${requiredEnvironments.length} environments enumerated\n` +
      `  ${requiredVerdicts.length} verdict classes present\n` +
      `  ${requiredToneSignals.length} tone signals distributed\n` +
      `  ${requiredScripts.length} validator scripts registered\n`,
  );
}

main().catch((err) => {
  console.error('Validator threw:', err);
  process.exit(1);
});
