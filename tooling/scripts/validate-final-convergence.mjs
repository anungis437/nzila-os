#!/usr/bin/env node

/**
 * Nzila OS — Final Convergence Validator
 *
 * Enforces the final maturity convergence layer:
 *  - all required final-convergence doctrine docs exist
 *  - upstream cognition + maturity-elevation anchors still present
 *  - master final convergence index covers required convergence axes
 *  - final full maturity review covers required maturity axes
 *  - required validator scripts registered in root package.json
 *  - required convergence tone signals distributed across docs
 *
 * Doctrine anchor: docs/nzila-final-convergence/README.md
 *
 * This validator optimizes for refinement and coherence — not expansion.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const finalRoot = path.join(repoRoot, 'docs', 'nzila-final-convergence');
const elevationRoot = path.join(repoRoot, 'docs', 'nzila-maturity-elevation');
const cognitionRoot = path.join(repoRoot, 'docs', 'nzila-cognition-doctrine');
const rootPackageJson = path.join(repoRoot, 'package.json');

const requiredFinalDocs = [
  'README.md',
  'runtime-semantic-convergence.md',
  'package-naming-substrate-finalization.md',
  'cross-app-ux-embodiment-finalization.md',
  'live-operational-adoption-hardening.md',
  'institutional-field-pressure-hardening.md',
  'real-operator-journey-finalization.md',
  'executive-procurement-realism-hardening.md',
  'cross-app-live-e2e-realism-matrix.md',
  'master-final-convergence-index.md',
  'final-full-maturity-review.md',
];

const requiredUpstreamAnchors = [
  ['nzila-cognition-doctrine', 'institutional-operational-cognition-doctrine.md'],
  ['nzila-cognition-doctrine', 'cross-app-cognition-consistency.md'],
  ['nzila-cognition-doctrine', 'procurement-governance-positioning-refactor.md'],
  ['nzila-maturity-elevation', 'README.md'],
  ['nzila-maturity-elevation', 'master-maturity-index.md'],
];

// Master final convergence index must cover these convergence axes.
const requiredIndexAxes = [
  'semantic convergence',
  'package convergence',
  'ux embodiment convergence',
  'operational realism',
  'onboarding maturity',
  'procurement realism',
  'field-pressure hardening',
  'operator journeys',
];

// Required canonical tone signals across the final-convergence layer.
const requiredToneSignals = [
  'mature',
  'fully mature',
  'bounded interpretation',
  'human reviewer of record',
  'final authority remains',
  'continuity-safe',
  'governance-safe',
  'anti-surveillance',
  'sustainable',
  'calm',
  'singular',
  'institutionally',
];

// Forbidden framings that must NOT appear in the final-convergence layer.
const forbiddenFramings = [
  'ai-first',
  'ai replaces',
  'autonomous executive',
  'ai ceo',
  'fully autonomous decision',
  'workforce ai',
];

// Required cross-app anchors in matrix + index.
const requiredAppAnchors = ['UE', 'Console', 'ExecutiveOS', 'UE Ops', 'CFO', 'FairCase'];

// Required validator scripts in root package.json.
const requiredScripts = [
  'validate:cognition',
  'validate:labor-continuity',
  'validate:maturity',
  'validate:maturity-elevation',
  'validate:final-convergence',
];

// Final maturity review required maturity axes.
const requiredReviewAxes = [
  'final convergence maturity',
  'operational realism maturity',
  'cognition maturity',
  'procurement maturity',
  'onboarding maturity',
  'institutional resilience maturity',
  'unresolved realism risks',
  'final ecosystem maturity verdict',
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

  // ── 1. Required final-convergence docs exist ─────────────────────
  const finalDocPaths = [];
  const missingFinal = [];
  for (const name of requiredFinalDocs) {
    const full = path.join(finalRoot, name);
    if (!(await exists(full))) {
      missingFinal.push(rel(full));
      continue;
    }
    finalDocPaths.push(full);
  }
  if (missingFinal.length > 0) {
    errors.push(`Missing required final-convergence docs:\n- ${missingFinal.join('\n- ')}`);
  }

  // ── 2. Required upstream anchor docs still present ───────────────
  const missingUpstream = [];
  for (const [dir, name] of requiredUpstreamAnchors) {
    const full = path.join(repoRoot, 'docs', dir, name);
    if (!(await exists(full))) missingUpstream.push(rel(full));
  }
  if (missingUpstream.length > 0) {
    errors.push(
      `Upstream anchor docs required by final convergence are missing:\n- ${missingUpstream.join('\n- ')}`,
    );
  }

  // ── 3. Master final convergence index covers required axes ───────
  const indexPath = path.join(finalRoot, 'master-final-convergence-index.md');
  if (await exists(indexPath)) {
    const indexLower = (await readText(indexPath)).toLowerCase();
    const missingAxes = requiredIndexAxes.filter((axis) => !indexLower.includes(axis));
    if (missingAxes.length > 0) {
      errors.push(`Master final convergence index missing required axes:\n- ${missingAxes.join('\n- ')}`);
    }
  }

  // ── 3b. Cross-app realism matrix covers all required app anchors ─
  const matrixPath = path.join(finalRoot, 'cross-app-live-e2e-realism-matrix.md');
  if (await exists(matrixPath)) {
    const matrixLower = (await readText(matrixPath)).toLowerCase();
    const missingApps = requiredAppAnchors.filter((app) => !matrixLower.includes(app.toLowerCase()));
    if (missingApps.length > 0) {
      errors.push(`Cross-app realism matrix missing required app anchors: ${missingApps.join(', ')}.`);
    }
  }

  // ── 4. Final full maturity review covers required maturity axes ──
  const reviewPath = path.join(finalRoot, 'final-full-maturity-review.md');
  if (await exists(reviewPath)) {
    const reviewLower = (await readText(reviewPath)).toLowerCase();
    const missingReviewAxes = requiredReviewAxes.filter((axis) => !reviewLower.includes(axis));
    if (missingReviewAxes.length > 0) {
      errors.push(
        `Final full maturity review missing required axes:\n- ${missingReviewAxes.join('\n- ')}`,
      );
    }
    const requiredValidatorMentions = [
      'validate:cognition',
      'validate:labor-continuity',
      'validate:maturity-elevation',
      'validate:final-convergence',
    ];
    const missingValidatorMentions = requiredValidatorMentions.filter((m) => !reviewLower.includes(m));
    if (missingValidatorMentions.length > 0) {
      errors.push(
        `Final full maturity review missing required validator references: ${missingValidatorMentions.join(', ')}.`,
      );
    }
  }

  // ── 5. Required convergence tone signals distributed ─────────────
  const finalJoinedLower = (await Promise.all(finalDocPaths.map(readText))).join('\n\n').toLowerCase();
  const missingTone = requiredToneSignals.filter((s) => !finalJoinedLower.includes(s));
  if (missingTone.length > 0) {
    errors.push(`Required convergence tone signals missing across doctrine:\n- ${missingTone.join('\n- ')}`);
  }

  // ── 6. Forbidden framings absent across doctrine ─────────────────
  // Context-aware: only flag if the framing appears positively (not negated by surrounding cues in either direction).
  const negationPattern = /(avoid|forbidden|reject|rejected|without|never|absent|prohibit|anti-|must not|no longer|not\s+(present|appear|use|allowed)|do not|don't|disallow|excluded|enumerated\b)/;
  const forbiddenHits = [];
  for (const phrase of forbiddenFramings) {
    let idx = finalJoinedLower.indexOf(phrase);
    while (idx !== -1) {
      const before = finalJoinedLower.slice(Math.max(0, idx - 160), idx);
      const after = finalJoinedLower.slice(idx + phrase.length, idx + phrase.length + 160);
      const negated = negationPattern.test(before) || negationPattern.test(after);
      if (!negated) {
        forbiddenHits.push(`"${phrase}" near offset ${idx}`);
        break;
      }
      idx = finalJoinedLower.indexOf(phrase, idx + phrase.length);
    }
  }
  if (forbiddenHits.length > 0) {
    errors.push(
      `Forbidden framings appear unbounded in final-convergence doctrine:\n- ${forbiddenHits.join('\n- ')}`,
    );
  }

  // ── 7. Validator scripts registered in root package.json ─────────
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
    console.error('\nFinal convergence validation FAILED.\n');
    for (const err of errors) console.error(`- ${err}\n`);
    process.exit(1);
  }

  console.log('Final convergence validation passed.');
  console.log(`Validated final-convergence docs: ${finalDocPaths.length}`);
  console.log(`Validated upstream anchors: ${requiredUpstreamAnchors.length}`);
  console.log(`Validated required scripts: ${requiredScripts.length}`);
}

main().catch((error) => {
  console.error('Final convergence validator crashed:', error);
  process.exit(1);
});
