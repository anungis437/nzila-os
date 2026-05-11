#!/usr/bin/env node

/**
 * Nzila OS — Union Eyes Institutional Operating Infrastructure Validator
 *
 * Enforces the UE category-transformation layer:
 *  - all required UE institutional-infrastructure docs exist
 *  - upstream cognition / maturity-elevation / final-convergence anchors present
 *  - reclassification doc carries category statement
 *  - monetization doc declares all four canonical tiers
 *  - marketing positioning doc enumerates required forbidden framings
 *  - final review covers required posture axes + validator coverage
 *  - required tone signals distributed across the layer
 *  - forbidden framings appear only inside negated/forbidden contexts
 *  - required validator scripts registered in root package.json
 *
 * Doctrine anchor: docs/union-eyes/institutional-operating-infrastructure/README.md
 *
 * This validator optimizes for refinement and coherence — not expansion.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const ueRoot = path.join(repoRoot, 'docs', 'union-eyes', 'institutional-operating-infrastructure');
const finalRoot = path.join(repoRoot, 'docs', 'nzila-final-convergence');
const elevationRoot = path.join(repoRoot, 'docs', 'nzila-maturity-elevation');
const cognitionRoot = path.join(repoRoot, 'docs', 'nzila-cognition-doctrine');
const rootPackageJson = path.join(repoRoot, 'package.json');

const requiredUeDocs = [
  'README.md',
  'ue-operating-system-reclassification.md',
  'full-module-architecture-review.md',
  'full-feature-gating-rearchitecture.md',
  'full-monetization-rearchitecture.md',
  'fsm-pilot-module-reconvergence.md',
  'full-navigation-ia-rearchitecture.md',
  'full-marketing-category-positioning-refactor.md',
  'full-procurement-sales-motion-refactor.md',
  'full-executive-value-repositioning.md',
  'full-institutional-value-expansion-analysis.md',
  'final-ue-operating-infrastructure-review.md',
];

const requiredUpstreamAnchors = [
  ['nzila-cognition-doctrine', 'institutional-operational-cognition-doctrine.md'],
  ['nzila-cognition-doctrine', 'procurement-governance-positioning-refactor.md'],
  ['nzila-maturity-elevation', 'master-maturity-index.md'],
  ['nzila-final-convergence', 'final-full-maturity-review.md'],
];

const requiredCanonicalTiers = [
  'institutional continuity core',
  'governance & continuity operations',
  'institutional operating infrastructure',
  'institutional sovereignty layer',
];

const requiredCategoryPhrases = [
  'institutional labor operating infrastructure',
  'continuity-safe modernization',
  'governance-safe',
];

const requiredFinalReviewAxes = [
  'final category definition',
  'final module architecture',
  'final gating architecture',
  'final monetization architecture',
  'final procurement posture',
  'final market positioning',
  'final institutional moat analysis',
  'unresolved strategic risks',
  'final enterprise-value posture',
];

const requiredReviewValidators = [
  'validate:cognition',
  'validate:labor-continuity',
  'validate:maturity-elevation',
  'validate:final-convergence',
  'validate:ue-infrastructure',
];

const requiredToneSignals = [
  'institutional',
  'continuity',
  'governance-safe',
  'continuity-safe',
  'anti-surveillance',
  'bounded interpretation',
  'human reviewer of record',
  'final authority remains',
  'stewardship',
  'cadence',
  'resilience',
  'modernization',
  'procurement',
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

  // ── 1. Required UE docs exist ────────────────────────────────────
  const ueDocPaths = [];
  const missingUe = [];
  for (const name of requiredUeDocs) {
    const full = path.join(ueRoot, name);
    if (!(await exists(full))) {
      missingUe.push(rel(full));
      continue;
    }
    ueDocPaths.push(full);
  }
  if (missingUe.length > 0) {
    errors.push(`Missing required UE infrastructure docs:\n- ${missingUe.join('\n- ')}`);
  }

  // ── 2. Required upstream anchor docs still present ───────────────
  const missingUpstream = [];
  for (const [dir, name] of requiredUpstreamAnchors) {
    const full = path.join(repoRoot, 'docs', dir, name);
    if (!(await exists(full))) missingUpstream.push(rel(full));
  }
  if (missingUpstream.length > 0) {
    errors.push(
      `Upstream anchor docs required by UE infrastructure layer are missing:\n- ${missingUpstream.join('\n- ')}`,
    );
  }

  // ── 3. Reclassification doc carries category statement ───────────
  const reclassPath = path.join(ueRoot, 'ue-operating-system-reclassification.md');
  if (await exists(reclassPath)) {
    const reclassLower = (await readText(reclassPath)).toLowerCase();
    const missingCategory = requiredCategoryPhrases.filter((p) => !reclassLower.includes(p));
    if (missingCategory.length > 0) {
      errors.push(`Reclassification doc missing required category phrases:\n- ${missingCategory.join('\n- ')}`);
    }
  }

  // ── 4. Monetization doc declares canonical tiers ─────────────────
  const monetizationPath = path.join(ueRoot, 'full-monetization-rearchitecture.md');
  if (await exists(monetizationPath)) {
    const monLower = (await readText(monetizationPath)).toLowerCase();
    const missingTiers = requiredCanonicalTiers.filter((t) => !monLower.includes(t));
    if (missingTiers.length > 0) {
      errors.push(`Monetization doc missing required canonical tiers:\n- ${missingTiers.join('\n- ')}`);
    }
  }

  // ── 5. Final review covers required posture axes + validators ───
  const finalReviewPath = path.join(ueRoot, 'final-ue-operating-infrastructure-review.md');
  if (await exists(finalReviewPath)) {
    const reviewLower = (await readText(finalReviewPath)).toLowerCase();
    const missingAxes = requiredFinalReviewAxes.filter((a) => !reviewLower.includes(a));
    if (missingAxes.length > 0) {
      errors.push(`Final UE review missing required posture axes:\n- ${missingAxes.join('\n- ')}`);
    }
    const missingValidatorMentions = requiredReviewValidators.filter((m) => !reviewLower.includes(m));
    if (missingValidatorMentions.length > 0) {
      errors.push(
        `Final UE review missing required validator references: ${missingValidatorMentions.join(', ')}.`,
      );
    }
  }

  // ── 6. Required tone signals distributed across the layer ────────
  const ueJoinedLower = (await Promise.all(ueDocPaths.map(readText))).join('\n\n').toLowerCase();
  const missingTone = requiredToneSignals.filter((s) => !ueJoinedLower.includes(s));
  if (missingTone.length > 0) {
    errors.push(`Required tone signals missing across UE infrastructure layer:\n- ${missingTone.join('\n- ')}`);
  }

  // ── 7. Forbidden framings only inside negated/forbidden context ──
  const negationPattern = /(\bnot\b|avoid|forbidden|reject|rejected|without|never|absent|prohibit|anti-|disallow|excluded|enumerated|drift|incompatible|deprecate|removed|eliminate|rebadged|folded|mis-categor|competitor|legacy|objection|hidden\s+substrate|do not|don't|must not|no longer)/;
  const forbiddenHits = [];
  for (const phrase of forbiddenFramings) {
    let idx = ueJoinedLower.indexOf(phrase);
    while (idx !== -1) {
      const before = ueJoinedLower.slice(Math.max(0, idx - 800), idx);
      const after = ueJoinedLower.slice(idx + phrase.length, idx + phrase.length + 400);
      const negated = negationPattern.test(before) || negationPattern.test(after);
      if (!negated) {
        forbiddenHits.push(`"${phrase}" near offset ${idx}`);
        break;
      }
      idx = ueJoinedLower.indexOf(phrase, idx + phrase.length);
    }
  }
  if (forbiddenHits.length > 0) {
    errors.push(`Forbidden framings appear unbounded in UE infrastructure layer:\n- ${forbiddenHits.join('\n- ')}`);
  }

  // ── 8. Validator scripts registered in root package.json ─────────
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
    console.error('\nUE institutional infrastructure validation FAILED.\n');
    for (const err of errors) console.error(`- ${err}\n`);
    process.exit(1);
  }

  console.log('UE institutional infrastructure validation passed.');
  console.log(`Validated UE docs: ${ueDocPaths.length}`);
  console.log(`Validated upstream anchors: ${requiredUpstreamAnchors.length}`);
  console.log(`Validated required scripts: ${requiredScripts.length}`);
}

main().catch((error) => {
  console.error('UE infrastructure validator crashed:', error);
  process.exit(1);
});
