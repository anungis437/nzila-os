#!/usr/bin/env node

/**
 * Nzila OS — Maturity Elevation Convergence Validator
 *
 * Enforces ecosystem-wide maturity convergence:
 *  - all required maturity-elevation doctrine docs exist
 *  - the maturity index covers all canonical convergence axes
 *  - cognition + labor-continuity validators remain reachable (script registered)
 *  - master maturity index reflects every required convergence axis
 *  - readiness review references validator coverage
 *
 * Doctrine anchor: docs/nzila-maturity-elevation/README.md
 *
 * This validator optimizes for refinement and coherence — not expansion.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const elevationRoot = path.join(repoRoot, 'docs', 'nzila-maturity-elevation');
const cognitionRoot = path.join(repoRoot, 'docs', 'nzila-cognition-doctrine');
const rootPackageJson = path.join(repoRoot, 'package.json');

const requiredElevationDocs = [
  'README.md',
  'full-maturity-gap-audit.md',
  'cross-app-ux-maturity-convergence.md',
  'package-substrate-maturity-convergence.md',
  'full-role-continuity-maturity.md',
  'executive-cognition-maturity-elevation.md',
  'operational-cadence-maturity-finalization.md',
  'stabilization-ux-maturity.md',
  'procurement-maturity-elevation.md',
  'cross-app-e2e-maturity-matrix.md',
  'master-maturity-index.md',
  'final-maturity-readiness-review.md',
];

// Cognition doctrine must remain present — maturity elevation inherits from it.
const requiredCognitionAnchors = [
  'institutional-operational-cognition-doctrine.md',
  'global-anti-surveillance-enforcement.md',
  'cross-app-cognition-consistency.md',
  'procurement-governance-positioning-refactor.md',
];

// Required convergence axes that must be referenced in the master maturity index.
const requiredIndexAxes = [
  'ux convergence',
  'cognition convergence',
  'operational cadence convergence',
  'stabilization convergence',
  'role convergence',
  'package convergence',
  'procurement convergence',
  'governance convergence',
];

// Required maturity-tone signals expected across the doctrine layer.
const requiredMaturityTone = [
  'mature',
  'strong mature',
  'continuity-safe',
  'governance-safe',
  'sustainable',
  'calm',
  'bounded',
  'human reviewer of record',
  'final authority remains',
];

// Validator scripts that must be registered in root package.json.
const requiredScripts = [
  'validate:cognition',
  'validate:labor-continuity',
  'validate:maturity',
  'validate:maturity-elevation',
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

  // ── 1. Required elevation docs exist ─────────────────────────────
  const elevationDocPaths = [];
  const missingElevation = [];
  for (const name of requiredElevationDocs) {
    const full = path.join(elevationRoot, name);
    if (!(await exists(full))) {
      missingElevation.push(rel(full));
      continue;
    }
    elevationDocPaths.push(full);
  }
  if (missingElevation.length > 0) {
    errors.push(`Missing required maturity-elevation docs:\n- ${missingElevation.join('\n- ')}`);
  }

  // ── 2. Required cognition anchor docs still present ──────────────
  const missingCognition = [];
  for (const name of requiredCognitionAnchors) {
    const full = path.join(cognitionRoot, name);
    if (!(await exists(full))) missingCognition.push(rel(full));
  }
  if (missingCognition.length > 0) {
    errors.push(
      `Cognition doctrine anchors required by maturity elevation are missing:\n- ${missingCognition.join('\n- ')}`,
    );
  }

  // ── 3. Master maturity index covers all convergence axes ─────────
  const indexPath = path.join(elevationRoot, 'master-maturity-index.md');
  if (await exists(indexPath)) {
    const indexLower = (await readText(indexPath)).toLowerCase();
    const missingAxes = requiredIndexAxes.filter((axis) => !indexLower.includes(axis));
    if (missingAxes.length > 0) {
      errors.push(`Master maturity index missing required convergence axes:\n- ${missingAxes.join('\n- ')}`);
    }
  }

  // ── 4. Required maturity tone signals present across doctrine ────
  const elevationJoinedLower = (await Promise.all(elevationDocPaths.map(readText))).join('\n\n').toLowerCase();
  const missingTone = requiredMaturityTone.filter((s) => !elevationJoinedLower.includes(s));
  if (missingTone.length > 0) {
    errors.push(`Required maturity tone signals missing across doctrine:\n- ${missingTone.join('\n- ')}`);
  }

  // ── 5. Validator scripts registered in root package.json ─────────
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
      const scripts = (pkg.scripts ?? {});
      const missingScripts = requiredScripts.filter((s) => !(s in scripts));
      if (missingScripts.length > 0) {
        errors.push(`Required validator scripts missing in root package.json:\n- ${missingScripts.join('\n- ')}`);
      }
    }
  } else {
    errors.push('Root package.json is missing.');
  }

  // ── 6. Readiness review references validator coverage ────────────
  const readinessPath = path.join(elevationRoot, 'final-maturity-readiness-review.md');
  if (await exists(readinessPath)) {
    const readinessLower = (await readText(readinessPath)).toLowerCase();
    const requiredMentions = ['validate:cognition', 'validate:labor-continuity', 'validate:maturity'];
    const missingMentions = requiredMentions.filter((m) => !readinessLower.includes(m));
    if (missingMentions.length > 0) {
      errors.push(`Readiness review must reference validator coverage; missing: ${missingMentions.join(', ')}.`);
    }
  }

  if (errors.length > 0) {
    console.error('\nMaturity elevation convergence validation FAILED.\n');
    for (const err of errors) console.error(`- ${err}\n`);
    process.exit(1);
  }

  console.log('Maturity elevation convergence validation passed.');
  console.log(`Validated elevation docs: ${elevationDocPaths.length}`);
  console.log(`Validated required scripts: ${requiredScripts.length}`);
}

main().catch((error) => {
  console.error('Maturity elevation validator crashed:', error);
  process.exit(1);
});
