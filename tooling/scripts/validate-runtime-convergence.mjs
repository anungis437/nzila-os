#!/usr/bin/env node

/**
 * Nzila OS — Union Eyes Final Runtime Convergence Validator
 *
 * Enforces the post-doctrine experiential embodiment layer:
 *  - all required runtime-convergence docs exist
 *  - upstream navigation/monetization-matrix anchors present
 *  - cognition-sweep doc declares canonical bounded-cognition vocabulary
 *  - sidebar-convergence doc enumerates the canonical surface inventory
 *  - FSM reconvergence doc declares all required dispositions
 *  - cadence doc enumerates the canonical cadence posture
 *  - certification doc enumerates all four environments
 *  - final review covers required convergence axes + all canonical tiers + validator coverage
 *  - required tone signals distributed across the layer
 *  - forbidden framings appear only inside negated/forbidden contexts
 *  - validator script registered in root package.json
 *
 * Doctrine anchor: docs/union-eyes/runtime-convergence/README.md
 *
 * This validator optimizes for refinement and coherence — not expansion.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveUeAreaDir } from './lib/ue-doc-paths.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const layerRoot = resolveUeAreaDir(repoRoot, 'runtime-convergence');
const navRoot = resolveUeAreaDir(repoRoot, 'navigation-monetization-matrix');
const ueRoot = resolveUeAreaDir(repoRoot, 'institutional-operating-infrastructure');
const rootPackageJson = path.join(repoRoot, 'package.json');

const requiredDocs = [
  'README.md',
  'full-sidebar-navigation-convergence.md',
  'full-information-architecture-reconvergence.md',
  'fsm-pilot-module-runtime-reconvergence.md',
  'full-runtime-cognition-semantic-sweep.md',
  'full-executive-procurement-experience-convergence.md',
  'full-runtime-monetization-embodiment.md',
  'full-operational-rhythm-cadence-embodiment.md',
  'full-demo-pilot-experience-reconvergence.md',
  'full-symbol-package-semantic-convergence.md',
  'full-live-runtime-experience-certification.md',
  'final-runtime-convergence-review.md',
];

const requiredUpstreamAnchors = [
  ['navigation-monetization-matrix', 'README.md'],
  ['navigation-monetization-matrix', 'tier1-institutional-continuity-core.md'],
  ['navigation-monetization-matrix', 'tier2-governance-continuity-operations.md'],
  ['navigation-monetization-matrix', 'tier3-institutional-operating-infrastructure.md'],
  ['navigation-monetization-matrix', 'tier4-institutional-sovereignty-layer.md'],
  ['navigation-monetization-matrix', 'final-gating-philosophy.md'],
  ['institutional-operating-infrastructure', 'fsm-pilot-module-reconvergence.md'],
];

const requiredCanonicalTiers = [
  'institutional continuity core',
  'governance & continuity operations',
  'institutional operating infrastructure',
  'institutional sovereignty layer',
];

const requiredNavSurfaces = [
  'home',
  'work',
  'priority',
  'outcomes',
  'continuity',
  'governance',
  'cadence',
  'onboarding',
  'intelligence',
  'executive',
  'operations',
  'assurance',
  'memory',
  'sovereignty',
  'trust center',
  'strategic operations',
  'settings',
];

const requiredCognitionVocabulary = [
  'cognition',
  'bounded synthesis',
  'reviewer-of-record',
  'evidence-anchored interpretation',
  'governance-safe cognition',
  'continuity-safe interpretation',
];

const requiredFsmDispositions = [
  'merge',
  'retire',
  'convert to substrate',
  'convert to continuity primitive',
  'convert to cadence primitive',
  'convert to onboarding infrastructure',
  'hide from runtime',
  'convert to governance infrastructure',
];

const requiredCadencePostures = [
  'daily',
  'weekly',
  'monthly',
  'quarterly',
];

const requiredEnvironments = [
  'dev',
  'staging',
  'demo',
  'pilot',
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

const requiredScripts = [
  'validate:cognition',
  'validate:labor-continuity',
  'validate:maturity-elevation',
  'validate:final-convergence',
  'validate:ue-infrastructure',
  'validate:navigation-monetization',
  'validate:runtime-convergence',
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

  // ── 1. Required runtime-convergence docs exist ───────────────────
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
    errors.push(`Missing required runtime-convergence docs:\n- ${missingDocs.join('\n- ')}`);
  }

  // ── 2. Required upstream anchor docs still present ───────────────
  const missingUpstream = [];
  for (const [dir, name] of requiredUpstreamAnchors) {
    const full = path.join(resolveUeAreaDir(repoRoot, dir), name);
    if (!(await exists(full))) missingUpstream.push(rel(full));
  }
  if (missingUpstream.length > 0) {
    errors.push(
      `Upstream UE anchors required by runtime-convergence layer are missing:\n- ${missingUpstream.join('\n- ')}`,
    );
  }

  // ── 3. Sidebar doc enumerates the canonical surface inventory ────
  const sidebarPath = path.join(layerRoot, 'full-sidebar-navigation-convergence.md');
  if (await exists(sidebarPath)) {
    const lower = (await readText(sidebarPath)).toLowerCase();
    const missing = requiredNavSurfaces.filter((s) => !lower.includes(s));
    if (missing.length > 0) {
      errors.push(`Sidebar convergence doc missing required surface inventory items:\n- ${missing.join('\n- ')}`);
    }
  }

  // ── 4. Cognition-sweep doc declares canonical bounded vocabulary ─
  const cognitionPath = path.join(layerRoot, 'full-runtime-cognition-semantic-sweep.md');
  if (await exists(cognitionPath)) {
    const lower = (await readText(cognitionPath)).toLowerCase();
    const missing = requiredCognitionVocabulary.filter((v) => !lower.includes(v));
    if (missing.length > 0) {
      errors.push(`Cognition sweep doc missing required canonical vocabulary:\n- ${missing.join('\n- ')}`);
    }
  }

  // ── 5. FSM reconvergence doc declares all dispositions ───────────
  const fsmPath = path.join(layerRoot, 'fsm-pilot-module-runtime-reconvergence.md');
  if (await exists(fsmPath)) {
    const lower = (await readText(fsmPath)).toLowerCase();
    const missing = requiredFsmDispositions.filter((d) => !lower.includes(d));
    if (missing.length > 0) {
      errors.push(`FSM runtime-reconvergence doc missing required dispositions:\n- ${missing.join('\n- ')}`);
    }
  }

  // ── 6. Cadence doc enumerates canonical cadence posture ──────────
  const cadencePath = path.join(layerRoot, 'full-operational-rhythm-cadence-embodiment.md');
  if (await exists(cadencePath)) {
    const lower = (await readText(cadencePath)).toLowerCase();
    const missing = requiredCadencePostures.filter((c) => !lower.includes(c));
    if (missing.length > 0) {
      errors.push(`Cadence embodiment doc missing required cadence postures:\n- ${missing.join('\n- ')}`);
    }
  }

  // ── 7. Certification doc enumerates all four environments ────────
  const certPath = path.join(layerRoot, 'full-live-runtime-experience-certification.md');
  if (await exists(certPath)) {
    const lower = (await readText(certPath)).toLowerCase();
    const missing = requiredEnvironments.filter((e) => !lower.includes(e));
    if (missing.length > 0) {
      errors.push(`Live certification doc missing required environments:\n- ${missing.join('\n- ')}`);
    }
  }

  // ── 8. Final review covers axes + tiers + validators ─────────────
  const finalReviewPath = path.join(layerRoot, 'final-runtime-convergence-review.md');
  if (await exists(finalReviewPath)) {
    const reviewLower = (await readText(finalReviewPath)).toLowerCase();
    const missingAxes = requiredFinalReviewAxes.filter((a) => !reviewLower.includes(a));
    if (missingAxes.length > 0) {
      errors.push(`Final runtime-convergence review missing required axes:\n- ${missingAxes.join('\n- ')}`);
    }
    const missingTiers = requiredCanonicalTiers.filter((t) => !reviewLower.includes(t));
    if (missingTiers.length > 0) {
      errors.push(`Final runtime-convergence review missing canonical tiers:\n- ${missingTiers.join('\n- ')}`);
    }
    const missingValidators = requiredReviewValidators.filter((m) => !reviewLower.includes(m));
    if (missingValidators.length > 0) {
      errors.push(
        `Final runtime-convergence review missing validator references: ${missingValidators.join(', ')}.`,
      );
    }
  }

  // ── 9. Required tone signals distributed across the layer ────────
  const joinedLower = (await Promise.all(docPaths.map(readText))).join('\n\n').toLowerCase();
  const missingTone = requiredToneSignals.filter((s) => !joinedLower.includes(s));
  if (missingTone.length > 0) {
    errors.push(`Required tone signals missing across runtime-convergence layer:\n- ${missingTone.join('\n- ')}`);
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
    errors.push(`Forbidden framings appear unbounded in runtime-convergence layer:\n- ${forbiddenHits.join('\n- ')}`);
  }

  // ── 11. Validator scripts registered in root package.json ────────
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
    console.error('\nRuntime-convergence validation FAILED.\n');
    for (const err of errors) console.error(`- ${err}\n`);
    process.exit(1);
  }

  console.log('Runtime-convergence validation passed.');
  console.log(`Validated docs: ${docPaths.length}`);
  console.log(`Validated upstream anchors: ${requiredUpstreamAnchors.length}`);
  console.log(`Validated required scripts: ${requiredScripts.length}`);
}

main().catch((error) => {
  console.error('Runtime-convergence validator crashed:', error);
  process.exit(1);
});
