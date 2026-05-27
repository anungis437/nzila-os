#!/usr/bin/env node

/**
 * Nzila OS — Tier 3 Operating Infrastructure Validator
 *
 * Enforces:
 *  - Tier 3 authority docs exist
 *  - required upstream authority anchors exist
 *  - Tier 3 nav doctrine includes required operating surfaces
 *  - Tier 3 review includes environment + verdict vocabulary
 *  - required tone signals exist across Tier 3 layer
 *
 * Option-B aligned: validates executable/doc paths directly, not package script registration.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const layerRoot = path.join(repoRoot, 'docs', 'nzila-tier3-operating-infrastructure');

const requiredDocs = [
  'README.md',
  'full-tier3-operating-infrastructure-review.md',
];

const requiredUpstreamAnchors = [
  ['docs', 'nzila-runtime-integrity', 'final-runtime-integrity-review.md'],
  ['docs', 'nzila-sovereignty-proving', 'full-tier2-operational-sovereignty-review.md'],
  ['docs', 'categories', 'products-and-market', 'union-eyes', 'navigation-monetization-matrix', 'tier3-institutional-operating-infrastructure.md'],
  ['docs', 'categories', 'products-and-market', 'union-eyes', 'navigation-monetization-matrix', 'final-gating-philosophy.md'],
  ['docs', 'categories', 'products-and-market', 'union-eyes', 'institutional-operating-infrastructure', 'README.md'],
  ['docs', 'categories', 'products-and-market', 'union-eyes', 'institutional-operating-infrastructure', 'final-ue-operating-infrastructure-review.md'],
  ['tooling', 'scripts', 'validate-tier2-hardening.mjs'],
  ['tooling', 'scripts', 'validate-runtime-integrity.mjs'],
  ['tooling', 'scripts', 'validate-sovereignty-proving.mjs'],
  ['tooling', 'scripts', 'validate-residual-closure.mjs'],
  ['tooling', 'scripts', 'validate-tier3-operating-infrastructure.mjs'],
];

const requiredTier3Surfaces = [
  'executive cognition',
  'federation continuity',
  'institutional memory',
  'operational assurance',
  'rollout governance',
  'operational proving',
  'procurement infrastructure',
];

const requiredEnvironments = ['dev', 'staging', 'demo', 'pilot'];
const requiredVerdicts = ['go', 'conditional go', 'no-go'];

const requiredToneSignals = [
  'institutional',
  'continuity-safe',
  'governance-safe',
  'anti-surveillance',
  'evidence-anchored',
  'reviewer-of-record',
  'bounded',
  'deterministic',
  'operational',
  'calm',
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
    errors.push(`Missing required Tier 3 docs:\n- ${missingDocs.join('\n- ')}`);
  }

  const missingAnchors = [];
  for (const parts of requiredUpstreamAnchors) {
    const full = path.join(repoRoot, ...parts);
    if (!(await exists(full))) missingAnchors.push(rel(full));
  }
  if (missingAnchors.length > 0) {
    errors.push(`Missing upstream Tier 3 anchors:\n- ${missingAnchors.join('\n- ')}`);
  }

  const tier3NavPath = path.join(
    repoRoot,
    'docs',
    'categories',
    'products-and-market',
    'union-eyes',
    'navigation-monetization-matrix',
    'tier3-institutional-operating-infrastructure.md',
  );
  if (await exists(tier3NavPath)) {
    const navLower = (await readText(tier3NavPath)).toLowerCase();
    const missingSurfaces = requiredTier3Surfaces.filter((s) => !navLower.includes(s));
    if (missingSurfaces.length > 0) {
      errors.push(`Tier 3 navigation doctrine missing required surfaces:\n- ${missingSurfaces.join('\n- ')}`);
    }
  }

  const reviewPath = path.join(layerRoot, 'full-tier3-operating-infrastructure-review.md');
  if (await exists(reviewPath)) {
    const reviewLower = (await readText(reviewPath)).toLowerCase();
    const missingEnv = requiredEnvironments.filter((e) => !reviewLower.includes(e));
    if (missingEnv.length > 0) {
      errors.push(`Tier 3 review missing required environments:\n- ${missingEnv.join('\n- ')}`);
    }
    const missingVerdicts = requiredVerdicts.filter((v) => !reviewLower.includes(v));
    if (missingVerdicts.length > 0) {
      errors.push(`Tier 3 review missing required verdict vocabulary:\n- ${missingVerdicts.join('\n- ')}`);
    }
  }

  const joinedLower = (await Promise.all(docPaths.map(readText))).join('\n\n').toLowerCase();
  const missingTone = requiredToneSignals.filter((s) => !joinedLower.includes(s));
  if (missingTone.length > 0) {
    errors.push(`Required tone signals missing across Tier 3 layer:\n- ${missingTone.join('\n- ')}`);
  }

  if (errors.length > 0) {
    console.error('\nTier 3 operating infrastructure validation FAILED.\n');
    for (const err of errors) console.error(`- ${err}\n`);
    process.exit(1);
  }

  console.log('Tier 3 operating infrastructure validation PASSED.');
  console.log(`Validated docs: ${docPaths.length}`);
  console.log(`Validated upstream anchors: ${requiredUpstreamAnchors.length}`);
  console.log(`Validated Tier 3 surfaces: ${requiredTier3Surfaces.length}`);
}

main().catch((err) => {
  console.error('Tier 3 validator crashed:', err);
  process.exit(1);
});
