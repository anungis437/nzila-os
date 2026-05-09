#!/usr/bin/env node

/**
 * Nzila OS — Union Eyes Navigation & Monetization Access Matrix Validator
 *
 * Enforces the post-doctrine runtime experience architecture layer:
 *  - all required navigation/monetization-matrix docs exist
 *  - upstream UE infrastructure anchors present
 *  - core principle doc carries the "navigation IS monetization" statement
 *  - tier docs declare canonical tier names
 *  - tier docs enumerate the required navigation surfaces
 *  - gating philosophy doc lists required maturity axes
 *  - final review covers required posture axes + validator coverage
 *  - required tone signals distributed across the layer
 *  - forbidden framings appear only inside negated/forbidden contexts
 *  - required validator scripts registered in root package.json
 *
 * Doctrine anchor: docs/union-eyes/navigation-monetization-matrix/README.md
 *
 * This validator optimizes for refinement and coherence — not expansion.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const navRoot = path.join(repoRoot, 'docs', 'union-eyes', 'navigation-monetization-matrix');
const ueRoot = path.join(repoRoot, 'docs', 'union-eyes', 'institutional-operating-infrastructure');
const rootPackageJson = path.join(repoRoot, 'package.json');

const requiredNavDocs = [
  'README.md',
  'core-principle-navigation-is-monetization.md',
  'tier1-institutional-continuity-core.md',
  'tier2-governance-continuity-operations.md',
  'tier3-institutional-operating-infrastructure.md',
  'tier4-institutional-sovereignty-layer.md',
  'final-gating-philosophy.md',
  'final-ux-structure.md',
  'marketing-impact-narrative-shift.md',
  'homepage-demo-sales-impact.md',
  'final-navigation-monetization-review.md',
];

const requiredUpstreamAnchors = [
  ['institutional-operating-infrastructure', 'ue-operating-system-reclassification.md'],
  ['institutional-operating-infrastructure', 'full-navigation-ia-rearchitecture.md'],
  ['institutional-operating-infrastructure', 'full-monetization-rearchitecture.md'],
  ['institutional-operating-infrastructure', 'full-feature-gating-rearchitecture.md'],
  ['institutional-operating-infrastructure', 'final-ue-operating-infrastructure-review.md'],
];

const requiredCanonicalTiers = [
  'institutional continuity core',
  'governance & continuity operations',
  'institutional operating infrastructure',
  'institutional sovereignty layer',
];

const requiredMaturityAxes = [
  'continuity',
  'governance',
  'executive',
  'cadence',
  'stewardship',
  'memory',
  'federation',
  'proving',
  'procurement',
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

const requiredFinalReviewAxes = [
  'final principle',
  'final tier structure',
  'final navigation surface inventory',
  'final gating philosophy',
  'final ux posture',
  'final marketing posture',
  'final demo & sales posture',
  'final moat',
  'unresolved strategic risks',
];

const requiredReviewValidators = [
  'validate:cognition',
  'validate:labor-continuity',
  'validate:maturity-elevation',
  'validate:final-convergence',
  'validate:ue-infrastructure',
  'validate:navigation-monetization',
];

const requiredToneSignals = [
  'institutional',
  'continuity',
  'governance-safe',
  'continuity-safe',
  'anti-surveillance',
  'stewardship',
  'cadence',
  'resilience',
  'modernization',
  'procurement',
  'maturity',
  'operational',
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
];

const requiredScripts = [
  'validate:cognition',
  'validate:labor-continuity',
  'validate:maturity',
  'validate:maturity-elevation',
  'validate:final-convergence',
  'validate:ue-infrastructure',
  'validate:navigation-monetization',
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

  // ── 1. Required navigation/monetization docs exist ───────────────
  const docPaths = [];
  const missingDocs = [];
  for (const name of requiredNavDocs) {
    const full = path.join(navRoot, name);
    if (!(await exists(full))) {
      missingDocs.push(rel(full));
      continue;
    }
    docPaths.push(full);
  }
  if (missingDocs.length > 0) {
    errors.push(`Missing required navigation/monetization docs:\n- ${missingDocs.join('\n- ')}`);
  }

  // ── 2. Required upstream anchor docs still present ───────────────
  const missingUpstream = [];
  for (const [dir, name] of requiredUpstreamAnchors) {
    const full = path.join(repoRoot, 'docs', 'union-eyes', dir, name);
    if (!(await exists(full))) missingUpstream.push(rel(full));
  }
  if (missingUpstream.length > 0) {
    errors.push(
      `Upstream UE infrastructure anchors required by navigation/monetization layer are missing:\n- ${missingUpstream.join('\n- ')}`,
    );
  }

  // ── 3. Core principle doc carries the canonical statement ────────
  const corePath = path.join(navRoot, 'core-principle-navigation-is-monetization.md');
  if (await exists(corePath)) {
    const coreLower = (await readText(corePath)).toLowerCase();
    const required = ['navigation is monetization', 'operational maturity', 'category signaling'];
    const missing = required.filter((p) => !coreLower.includes(p));
    if (missing.length > 0) {
      errors.push(`Core principle doc missing required canonical phrases:\n- ${missing.join('\n- ')}`);
    }
  }

  // ── 4. Tier docs declare canonical tier names ────────────────────
  const tierFiles = [
    'tier1-institutional-continuity-core.md',
    'tier2-governance-continuity-operations.md',
    'tier3-institutional-operating-infrastructure.md',
    'tier4-institutional-sovereignty-layer.md',
  ];
  for (let i = 0; i < tierFiles.length; i += 1) {
    const tierPath = path.join(navRoot, tierFiles[i]);
    if (!(await exists(tierPath))) continue;
    const lower = (await readText(tierPath)).toLowerCase();
    if (!lower.includes(requiredCanonicalTiers[i])) {
      errors.push(`${tierFiles[i]} does not reference canonical tier name "${requiredCanonicalTiers[i]}".`);
    }
  }

  // ── 5. Final review covers required posture axes + validators ───
  const finalReviewPath = path.join(navRoot, 'final-navigation-monetization-review.md');
  if (await exists(finalReviewPath)) {
    const reviewLower = (await readText(finalReviewPath)).toLowerCase();
    const missingAxes = requiredFinalReviewAxes.filter((a) => !reviewLower.includes(a));
    if (missingAxes.length > 0) {
      errors.push(`Final navigation/monetization review missing required posture axes:\n- ${missingAxes.join('\n- ')}`);
    }
    const missingValidatorMentions = requiredReviewValidators.filter((m) => !reviewLower.includes(m));
    if (missingValidatorMentions.length > 0) {
      errors.push(
        `Final navigation/monetization review missing required validator references: ${missingValidatorMentions.join(', ')}.`,
      );
    }
    const missingNavSurfaces = requiredNavSurfaces.filter((s) => !reviewLower.includes(s));
    if (missingNavSurfaces.length > 0) {
      errors.push(
        `Final navigation/monetization review missing required navigation surfaces:\n- ${missingNavSurfaces.join('\n- ')}`,
      );
    }
  }

  // ── 6. Gating philosophy enumerates maturity axes ────────────────
  const gatingPath = path.join(navRoot, 'final-gating-philosophy.md');
  if (await exists(gatingPath)) {
    const gatingLower = (await readText(gatingPath)).toLowerCase();
    const missingAxes = requiredMaturityAxes.filter((a) => !gatingLower.includes(a));
    if (missingAxes.length > 0) {
      errors.push(`Gating philosophy doc missing required maturity axes:\n- ${missingAxes.join('\n- ')}`);
    }
  }

  // ── 7. Required tone signals distributed across the layer ────────
  const joinedLower = (await Promise.all(docPaths.map(readText))).join('\n\n').toLowerCase();
  const missingTone = requiredToneSignals.filter((s) => !joinedLower.includes(s));
  if (missingTone.length > 0) {
    errors.push(`Required tone signals missing across navigation/monetization layer:\n- ${missingTone.join('\n- ')}`);
  }

  // ── 8. Forbidden framings only inside negated/forbidden context ──
  const negationPattern = /(\bnot\b|avoid|forbidden|reject|rejected|without|never|absent|prohibit|anti-|disallow|excluded|enumerated|drift|incompatible|deprecate|removed|eliminate|rebadged|folded|mis-categor|competitor|legacy|objection|do not|don't|must not|no longer|dead|old|bad)/;
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
    errors.push(`Forbidden framings appear unbounded in navigation/monetization layer:\n- ${forbiddenHits.join('\n- ')}`);
  }

  // ── 9. Validator scripts registered in root package.json ─────────
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
    console.error('\nNavigation/monetization matrix validation FAILED.\n');
    for (const err of errors) console.error(`- ${err}\n`);
    process.exit(1);
  }

  console.log('Navigation/monetization matrix validation passed.');
  console.log(`Validated docs: ${docPaths.length}`);
  console.log(`Validated upstream anchors: ${requiredUpstreamAnchors.length}`);
  console.log(`Validated required scripts: ${requiredScripts.length}`);
}

main().catch((error) => {
  console.error('Navigation/monetization validator crashed:', error);
  process.exit(1);
});
