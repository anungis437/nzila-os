#!/usr/bin/env node
/**
 * validate-live-operational-readiness.mjs
 *
 * Validates the existence and structural sanity of the Nzila Live Operational
 * Audit corpus under docs/nzila-live-audit/.
 *
 * Exit code 0 = all gates pass; 1 = at least one gate failed.
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const auditDir = join(repoRoot, 'docs', 'nzila-live-audit');

const REQUIRED_DOCS = [
  'README.md',
  'full-environment-inventory-audit.md',
  'authoritative-url-domain-audit.md',
  'live-auth-role-access-audit.md',
  'test-persona-credentials-audit.md',
  'full-page-navigation-reality-audit.md',
  'full-e2e-environment-validation.md',
  'live-feature-gating-audit.md',
  'monetization-doctrine-alignment-audit.md',
  'ue-whole-system-review.md',
  'final-live-operational-status-report.md',
];

const REQUIRED_REFERENCED_FILES = [
  'apps/union-eyes/db/db.ts',
  'apps/union-eyes/playwright.config.ts',
  'apps/union-eyes/lib/feature-flags.ts',
  'apps/union-eyes/tests/fixtures/test-users.ts',
  'apps/console/lib/nav-config.ts',
  'apps/trustcore/types/core.ts',
  'governance/release/domain-routing-registry.json',
  '.github/workflows/e2e.yml',
  '.github/workflows/gitops-deploy.yml',
  'tooling/scripts/validate-rollout-legitimacy.mjs',
];

const REQUIRED_VALIDATORS = [
  'tooling/scripts/validate-rollout-legitimacy.mjs',
];

const HONESTY_MARKERS = [
  'LIVE',
  'STAGING-ONLY',
  'RESERVED',
  'DEFERRED',
  'PARTIAL',
  'MOCKED',
  'SIMULATED',
  'BLOCKED',
  'MISSING',
];

const errors = [];
const warnings = [];

function checkAuditDir() {
  if (!existsSync(auditDir)) {
    errors.push(`Audit directory missing: ${auditDir}`);
    return false;
  }
  if (!statSync(auditDir).isDirectory()) {
    errors.push(`Audit path is not a directory: ${auditDir}`);
    return false;
  }
  return true;
}

function checkRequiredDocs() {
  for (const doc of REQUIRED_DOCS) {
    const fullPath = join(auditDir, doc);
    if (!existsSync(fullPath)) {
      errors.push(`Required audit doc missing: docs/nzila-live-audit/${doc}`);
      continue;
    }
    const content = readFileSync(fullPath, 'utf8');
    if (content.length < 200) {
      errors.push(`Audit doc too short (<200 chars): docs/nzila-live-audit/${doc}`);
    }
    if (!/^#\s+/m.test(content)) {
      errors.push(`Audit doc missing top-level heading: docs/nzila-live-audit/${doc}`);
    }
    // Substantive docs (non-README) should declare an Authority and at least
    // one operational honesty marker.
    if (doc !== 'README.md') {
      if (!/Authority\s*[:*]/i.test(content)) {
        warnings.push(`Audit doc missing 'Authority:' declaration: docs/nzila-live-audit/${doc}`);
      }
      const markerHit = HONESTY_MARKERS.some((m) =>
        new RegExp(`\\b${m}\\b`).test(content),
      );
      if (!markerHit) {
        errors.push(
          `Audit doc lacks any operational honesty marker (${HONESTY_MARKERS.join('|')}): docs/nzila-live-audit/${doc}`,
        );
      }
    }
  }
}

function checkReferencedFiles() {
  for (const rel of REQUIRED_REFERENCED_FILES) {
    const fullPath = join(repoRoot, rel);
    if (!existsSync(fullPath)) {
      errors.push(`Referenced source anchor missing: ${rel}`);
    }
  }
}

function checkExistingValidators() {
  for (const rel of REQUIRED_VALIDATORS) {
    const fullPath = join(repoRoot, rel);
    if (!existsSync(fullPath)) {
      errors.push(`Adjacent validator missing: ${rel}`);
    }
  }
}

function checkReadmeIndex() {
  const readme = join(auditDir, 'README.md');
  if (!existsSync(readme)) return;
  const content = readFileSync(readme, 'utf8');
  for (const doc of REQUIRED_DOCS) {
    if (doc === 'README.md') continue;
    if (!content.includes(doc)) {
      warnings.push(`README does not reference: ${doc}`);
    }
  }
}

function report() {
  const out = [];
  out.push('');
  out.push('Nzila Live Operational Readiness — Validation Report');
  out.push('='.repeat(60));
  out.push(`Audit directory: ${auditDir}`);
  out.push(`Required docs:   ${REQUIRED_DOCS.length}`);
  out.push('');

  if (warnings.length) {
    out.push(`Warnings (${warnings.length}):`);
    for (const w of warnings) out.push(`  - ${w}`);
    out.push('');
  }

  if (errors.length) {
    out.push(`Errors (${errors.length}):`);
    for (const e of errors) out.push(`  - ${e}`);
    out.push('');
    out.push('VERDICT: FAILED');
  } else {
    out.push('VERDICT: PASSED');
  }
  out.push('');
  return out.join('\n');
}

function main() {
  if (checkAuditDir()) {
    checkRequiredDocs();
    checkReadmeIndex();
  }
  checkReferencedFiles();
  checkExistingValidators();

  process.stdout.write(report());
  process.exit(errors.length === 0 ? 0 : 1);
}

main();
