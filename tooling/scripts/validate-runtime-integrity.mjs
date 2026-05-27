#!/usr/bin/env node

/**
 * Nzila OS — Final Institutional Identity & Runtime Integrity Validator
 *
 * Enforces the runtime substrate hardening doctrine layer:
 *  - all required runtime-integrity docs exist
 *  - upstream runtime-convergence + nav-monetization anchors present
 *  - auth-lineage doc enumerates the canonical identity surfaces
 *  - org-identity doc enumerates the canonical org cookies/sources
 *  - persona doc enumerates required persona surfaces
 *  - failure-architecture doc enumerates required failure dispositions
 *  - certification doc enumerates all four environments + verdicts
 *  - final review covers required convergence axes + validator coverage
 *  - required tone signals distributed across the layer
 *  - forbidden framings only inside negated/forbidden contexts
 *  - required validator executables exist in tooling/scripts
 *
 * Doctrine anchor: docs/nzila-runtime-integrity/README.md
 *
 * This validator optimizes for substrate hardening — not new features, not architecture
 * expansion, not runtime experimentation. Refinement, not accumulation.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const layerRoot = path.join(repoRoot, 'docs', 'nzila-runtime-integrity');
const runtimeConvergenceRoot = path.join(repoRoot, 'docs', 'union-eyes', 'runtime-convergence');
const navRoot = path.join(
  repoRoot,
  'docs',
  'categories',
  'products-and-market',
  'union-eyes',
  'navigation-monetization-matrix',
);

const requiredDocs = [
  'README.md',
  'full-auth-role-lineage-audit.md',
  'full-organization-identity-convergence.md',
  'full-seeded-persona-legitimacy-hardening.md',
  'full-dashboard-runtime-failure-integrity.md',
  'full-workspace-package-substrate-convergence.md',
  'full-governance-safe-failure-architecture.md',
  'full-e2e-identity-convergence.md',
  'full-governance-noise-reduction.md',
  'full-live-runtime-identity-certification.md',
  'final-runtime-integrity-review.md',
];

const requiredUpstreamAnchors = [
  ['union-eyes', 'runtime-convergence', 'README.md'],
  ['categories', 'products-and-market', 'union-eyes', 'navigation-monetization-matrix', 'README.md'],
  ['categories', 'products-and-market', 'union-eyes', 'navigation-monetization-matrix', 'tier1-institutional-continuity-core.md'],
  ['categories', 'products-and-market', 'union-eyes', 'navigation-monetization-matrix', 'tier2-governance-continuity-operations.md'],
  ['categories', 'products-and-market', 'union-eyes', 'navigation-monetization-matrix', 'tier3-institutional-operating-infrastructure.md'],
  ['categories', 'products-and-market', 'union-eyes', 'navigation-monetization-matrix', 'tier4-institutional-sovereignty-layer.md'],
  ['categories', 'products-and-market', 'union-eyes', 'navigation-monetization-matrix', 'final-gating-philosophy.md'],
];

const requiredAuthSurfaces = [
  'auth()',
  'currentuser()',
  'getuserrole',
  'getorganizationidforuser',
  'auth_user_sessions',
  'organization_members',
  'auth_organization_users',
  'nzila_session',
  'selected_org_id',
  'active-organization',
];

const requiredOrgSources = [
  'organization_members',
  'auth_organization_users',
  'default_organization_id',
  'selected_org_id',
  'active-organization',
];

const requiredPersonaSurfaces = [
  'seed-test-env',
  'ue_test_users',
  'auth_users',
  'auth_organization_users',
  'auth_user_sessions',
  'organization_members',
  'bootstrape2eauth',
  'role navigation',
  'redirect expectations',
];

const requiredFailureDispositions = [
  'fail-closed governance',
  'explicit degradation',
  'bounded runtime',
  'continuity-safe fallback',
  'operationally honest',
  'bounded cognition',
];

const requiredEnvironments = [
  'dev',
  'staging',
  'demo',
  'pilot',
];

const requiredVerdicts = [
  'go',
  'conditional go',
  'no-go',
];

const requiredFinalReviewAxes = [
  'final principle',
  'final tier structure',
  'final navigation surface inventory',
  'convergence status',
  'validator coverage',
  'unresolved runtime fragmentation risks',
  'final runtime maturity verdict',
  'final embodiment statement',
];

const requiredReviewValidators = [
  'validate:cognition',
  'validate:labor-continuity',
  'validate:maturity-elevation',
  'validate:final-convergence',
  'validate:ue-infrastructure',
  'validate:navigation-monetization',
  'validate:runtime-convergence',
  'validate:runtime-integrity',
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
  path.join(repoRoot, 'tooling', 'scripts', 'validate-institutional-cognition-convergence.mjs'),
  path.join(repoRoot, 'tooling', 'scripts', 'validate-labor-continuity-governance.mjs'),
  path.join(repoRoot, 'tooling', 'scripts', 'validate-maturity-convergence.mjs'),
  path.join(repoRoot, 'tooling', 'scripts', 'validate-final-convergence.mjs'),
  path.join(repoRoot, 'tooling', 'scripts', 'validate-ue-infrastructure.mjs'),
  path.join(repoRoot, 'tooling', 'scripts', 'validate-navigation-monetization.mjs'),
  path.join(repoRoot, 'tooling', 'scripts', 'validate-runtime-convergence.mjs'),
  path.join(repoRoot, 'tooling', 'scripts', 'validate-runtime-integrity.mjs'),
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

async function main() {
  const errors = [];

  // ── 1. Required runtime-integrity docs exist ─────────────────────
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
    errors.push(`Missing required runtime-integrity docs:\n- ${missingDocs.join('\n- ')}`);
  }

  // ── 2. Required upstream anchor docs still present ───────────────
  const missingUpstream = [];
  for (const parts of requiredUpstreamAnchors) {
    const full = path.join(repoRoot, 'docs', ...parts);
    if (!(await exists(full))) missingUpstream.push(rel(full));
  }
  if (missingUpstream.length > 0) {
    errors.push(
      `Upstream anchors required by runtime-integrity layer are missing:\n- ${missingUpstream.join('\n- ')}`,
    );
  }

  // ── 3. Auth-lineage doc enumerates canonical identity surfaces ───
  const authPath = path.join(layerRoot, 'full-auth-role-lineage-audit.md');
  if (await exists(authPath)) {
    const lower = (await readText(authPath)).toLowerCase();
    const missing = requiredAuthSurfaces.filter((s) => !lower.includes(s));
    if (missing.length > 0) {
      errors.push(`Auth-lineage doc missing required identity surfaces:\n- ${missing.join('\n- ')}`);
    }
  }

  // ── 4. Org-identity doc enumerates canonical org sources/cookies ─
  const orgPath = path.join(layerRoot, 'full-organization-identity-convergence.md');
  if (await exists(orgPath)) {
    const lower = (await readText(orgPath)).toLowerCase();
    const missing = requiredOrgSources.filter((s) => !lower.includes(s));
    if (missing.length > 0) {
      errors.push(`Org-identity doc missing required org sources/cookies:\n- ${missing.join('\n- ')}`);
    }
  }

  // ── 5. Persona doc enumerates required persona surfaces ──────────
  const personaPath = path.join(layerRoot, 'full-seeded-persona-legitimacy-hardening.md');
  if (await exists(personaPath)) {
    const lower = (await readText(personaPath)).toLowerCase();
    const missing = requiredPersonaSurfaces.filter((s) => !lower.includes(s));
    if (missing.length > 0) {
      errors.push(`Persona-hardening doc missing required persona surfaces:\n- ${missing.join('\n- ')}`);
    }
  }

  // ── 6. Failure-architecture doc enumerates required dispositions ─
  const failurePath = path.join(layerRoot, 'full-governance-safe-failure-architecture.md');
  if (await exists(failurePath)) {
    const lower = (await readText(failurePath)).toLowerCase();
    const missing = requiredFailureDispositions.filter((d) => !lower.includes(d));
    if (missing.length > 0) {
      errors.push(`Failure-architecture doc missing required dispositions:\n- ${missing.join('\n- ')}`);
    }
  }

  // ── 7. Certification doc enumerates environments + verdicts ──────
  const certPath = path.join(layerRoot, 'full-live-runtime-identity-certification.md');
  if (await exists(certPath)) {
    const lower = (await readText(certPath)).toLowerCase();
    const missingEnv = requiredEnvironments.filter((e) => !lower.includes(e));
    if (missingEnv.length > 0) {
      errors.push(`Live certification doc missing required environments:\n- ${missingEnv.join('\n- ')}`);
    }
    const missingVerdicts = requiredVerdicts.filter((v) => !lower.includes(v));
    if (missingVerdicts.length > 0) {
      errors.push(`Live certification doc missing required verdict vocabulary:\n- ${missingVerdicts.join('\n- ')}`);
    }
  }

  // ── 8. Final review covers axes + validators ─────────────────────
  const finalReviewPath = path.join(layerRoot, 'final-runtime-integrity-review.md');
  if (await exists(finalReviewPath)) {
    const reviewLower = (await readText(finalReviewPath)).toLowerCase();
    const missingAxes = requiredFinalReviewAxes.filter((a) => !reviewLower.includes(a));
    if (missingAxes.length > 0) {
      errors.push(`Final runtime-integrity review missing required axes:\n- ${missingAxes.join('\n- ')}`);
    }
    const missingValidators = requiredReviewValidators.filter((m) => !reviewLower.includes(m));
    if (missingValidators.length > 0) {
      errors.push(
        `Final runtime-integrity review missing validator references: ${missingValidators.join(', ')}.`,
      );
    }
  }

  // ── 9. Required tone signals distributed across the layer ────────
  const joinedLower = (await Promise.all(docPaths.map(readText))).join('\n\n').toLowerCase();
  const missingTone = requiredToneSignals.filter((s) => !joinedLower.includes(s));
  if (missingTone.length > 0) {
    errors.push(`Required tone signals missing across runtime-integrity layer:\n- ${missingTone.join('\n- ')}`);
  }

  // ── 10. Forbidden framings only inside negated/forbidden context ─
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
    errors.push(`Forbidden framings appear unbounded in runtime-integrity layer:\n- ${forbiddenHits.join('\n- ')}`);
  }

  // ── 11. Required validator executables exist ─────────────────────
  const missingValidators = [];
  for (const validatorPath of requiredValidatorPaths) {
    if (!(await exists(validatorPath))) missingValidators.push(rel(validatorPath));
  }
  if (missingValidators.length > 0) {
    errors.push(`Required validator executables missing:\n- ${missingValidators.join('\n- ')}`);
  }

  if (errors.length > 0) {
    console.error('\nRuntime-integrity validation FAILED.\n');
    for (const err of errors) console.error(`- ${err}\n`);
    process.exit(1);
  }

  console.log('Runtime-integrity validation passed.');
  console.log(`Validated docs: ${docPaths.length}`);
  console.log(`Validated upstream anchors: ${requiredUpstreamAnchors.length}`);
  console.log(`Validated required executables: ${requiredValidatorPaths.length}`);
}

main().catch((error) => {
  console.error('Runtime-integrity validator crashed:', error);
  process.exit(1);
});
