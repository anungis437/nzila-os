#!/usr/bin/env node

/**
 * Nzila OS — Residual Closure Validator
 *
 * Doctrine anchor: docs/nzila-residual-closure/README.md
 *
 * Enforces:
 *  - all required residual closure docs (R1–R9 + README + final review) exist
 *  - per-residual anchor checks (each doc names its real-action levers)
 *  - canonical environment + verdict vocabulary distributed across the layer
 *  - required tone signals distributed across the layer
 *  - forbidden framings only inside negated/forbidden contexts
 *  - required validator executables exist in tooling/scripts
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

const layerRoot = path.join(repoRoot, 'docs', 'nzila-residual-closure');

const requiredDocs = [
  'README.md',
  'r1-pilot-django-sidecar-binding-closure.md',
  'r2-cognition-degradation-drill-corpus.md',
  'r3-continuity-degradation-drill-corpus.md',
  'r4-notification-degradation-drill-corpus.md',
  'r5-locale-double-prefix-fix.md',
  'r6-seeded-persona-corpus-completion.md',
  'r7-operational-honesty-copy-sweep.md',
  'r8-provider-key-rotation-cadence.md',
  'r9-org-resolver-callsite-audit.md',
  'full-residual-elimination-review.md',
];

const requiredEnvironments = ['dev', 'staging', 'demo', 'pilot'];
const requiredVerdicts = ['closed', 'partially closed', 'deferred', 'conditional go'];

const requiredR1Anchors = [
  'django sidecar',
  'governance api binding',
  'health probes',
  'ingress routing',
  'auth_core',
  'aca revision',
  'fail-closed',
  'nzila-canada-pilot-rg',
  'nzila-canada-pilot-kv',
  'key vault secrets user',
];

const requiredR2Anchors = [
  'openai outage',
  'provider timeout',
  'malformed responses',
  'incomplete evidence',
  'cognition disablement',
  'governance-context absence',
  'continuity-context absence',
  'reviewer-of-record',
  'bounded retry',
];

const requiredR3Anchors = [
  'onboarding degradation',
  'steward-transition degradation',
  'governance-review degradation',
  'operational-memory degradation',
  'cadence degradation',
  'recovery restoration',
  'lineage',
  'append-only',
  'replay',
];

const requiredR4Anchors = [
  'email provider outage',
  'delayed notification queues',
  'webhook degradation',
  'retry collapse',
  'partial delivery failure',
  'bounded retries',
  'duplicate suppression',
  'escalation preservation',
  'dead-letter',
];

const requiredR5Anchors = [
  'locale alias',
  '308',
  'single-hop',
  'en-ca',
  'fr-ca',
  'proxy.ts',
  'recursive',
  'method-preserving',
];

const requiredR6Anchors = [
  'executive personas',
  'steward personas',
  'governance personas',
  'onboarding personas',
  'procurement personas',
  'degraded-runtime personas',
  'persona.unioneyes.app',
  'idempotency',
];

const requiredR7Anchors = [
  'service-degraded',
  'cognition-suppressed',
  'review-queued',
  'dispatch-degraded',
  'lineage-readonly',
  'cadence-paused',
  'operational-recovery',
  'inflated readiness',
  'celebratory recovery',
  'ambient ai assistant',
];

const requiredR8Anchors = [
  'openai',
  'resend',
  'stripe',
  'telemetry',
  'quarterly',
  'reviewer-of-record signature',
  'kv mint',
  'rotation log',
  'fingerprint',
];

const requiredR9Anchors = [
  'getorganizationidforuser',
  'auth().orgid',
  'stewards/page.tsx',
  'tenant/current/route.ts',
  'org/current/route.ts',
  'default_organization_id',
  'forbidden pattern',
  'no-org redirect',
];

const requiredReviewAnchors = [
  'r1',
  'r2',
  'r3',
  'r4',
  'r5',
  'r6',
  'r7',
  'r8',
  'r9',
  'closed',
  'partially closed',
  'deferred',
  'conditional go',
  'forbidden framings',
  'stewardship cadence',
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

const requiredValidatorPaths = [
  path.join(repoRoot, 'tooling', 'scripts', 'validate-runtime-integrity.mjs'),
  path.join(repoRoot, 'tooling', 'scripts', 'validate-tier2-hardening.mjs'),
  path.join(repoRoot, 'tooling', 'scripts', 'validate-sovereignty-proving.mjs'),
  path.join(repoRoot, 'tooling', 'scripts', 'validate-residual-closure.mjs'),
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

  // ── 1. Required residual docs exist ──────────────────────────────
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
    errors.push(`Missing required residual closure docs:\n- ${missingDocs.join('\n- ')}`);
  }

  // ── 2..10. Per-residual anchor checks ────────────────────────────
  errors.push(...(await checkDoc('r1-pilot-django-sidecar-binding-closure.md', requiredR1Anchors, 'R1 pilot Django sidecar binding closure')));
  errors.push(...(await checkDoc('r2-cognition-degradation-drill-corpus.md', requiredR2Anchors, 'R2 cognition degradation drill corpus')));
  errors.push(...(await checkDoc('r3-continuity-degradation-drill-corpus.md', requiredR3Anchors, 'R3 continuity degradation drill corpus')));
  errors.push(...(await checkDoc('r4-notification-degradation-drill-corpus.md', requiredR4Anchors, 'R4 notification degradation drill corpus')));
  errors.push(...(await checkDoc('r5-locale-double-prefix-fix.md', requiredR5Anchors, 'R5 locale double-prefix fix')));
  errors.push(...(await checkDoc('r6-seeded-persona-corpus-completion.md', requiredR6Anchors, 'R6 seeded persona corpus completion')));
  errors.push(...(await checkDoc('r7-operational-honesty-copy-sweep.md', requiredR7Anchors, 'R7 operational honesty copy sweep')));
  errors.push(...(await checkDoc('r8-provider-key-rotation-cadence.md', requiredR8Anchors, 'R8 provider key rotation cadence')));
  errors.push(...(await checkDoc('r9-org-resolver-callsite-audit.md', requiredR9Anchors, 'R9 org resolver call-site audit')));
  errors.push(...(await checkDoc('full-residual-elimination-review.md', requiredReviewAnchors, 'Full residual elimination review')));

  // ── 11. Per-environment + verdict vocabulary across the layer ────
  const joinedLower = (await Promise.all(docPaths.map(readText))).join('\n\n').toLowerCase();
  const missingEnv = requiredEnvironments.filter((e) => !joinedLower.includes(e));
  if (missingEnv.length > 0) {
    errors.push(`Residual closure layer missing environments:\n- ${missingEnv.join('\n- ')}`);
  }
  const missingVerdicts = requiredVerdicts.filter((v) => !joinedLower.includes(v));
  if (missingVerdicts.length > 0) {
    errors.push(`Residual closure layer missing verdict vocabulary:\n- ${missingVerdicts.join('\n- ')}`);
  }

  // ── 12. Required tone signals ────────────────────────────────────
  const missingTone = requiredToneSignals.filter((s) => !joinedLower.includes(s));
  if (missingTone.length > 0) {
    errors.push(`Required tone signals missing across residual closure layer:\n- ${missingTone.join('\n- ')}`);
  }

  // ── 13. Forbidden framings only inside negated context ───────────
  const negationPattern = /(\bnot\b|avoid|forbidden|reject|rejected|without|never|absent|prohibit|anti-|disallow|excluded|enumerated|drift|incompatible|deprecate|removed|eliminate|rebadged|folded|mis-categor|competitor|legacy|objection|do not|don't|must not|no longer|dead|old|bad|skipping|toward|silent|fabricat|hallucinat|inflated|symbolic|ambient)/;
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
    errors.push(`Forbidden framings appear unbounded in residual closure layer:\n- ${forbiddenHits.join('\n- ')}`);
  }

  // ── 14. Required validator executables exist ─────────────────────
  const missingValidators = [];
  for (const validatorPath of requiredValidatorPaths) {
    if (!(await exists(validatorPath))) missingValidators.push(rel(validatorPath));
  }
  if (missingValidators.length > 0) {
    errors.push(`Required validator executables missing:\n- ${missingValidators.join('\n- ')}`);
  }

  if (errors.length > 0) {
    console.error('\nResidual closure validation FAILED.\n');
    for (const err of errors) console.error(`- ${err}\n`);
    process.exit(1);
  }

  console.log(
    `Residual closure validation PASSED.\n` +
      `  ${requiredDocs.length} residual closure docs present\n` +
      `  ${requiredEnvironments.length} environments enumerated\n` +
      `  ${requiredVerdicts.length} verdict classes present\n` +
      `  ${requiredToneSignals.length} tone signals distributed\n` +
      `  ${requiredValidatorPaths.length} validator executables present\n`,
  );
}

main().catch((err) => {
  console.error('Validator threw:', err);
  process.exit(1);
});
