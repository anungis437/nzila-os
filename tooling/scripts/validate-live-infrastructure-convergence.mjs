#!/usr/bin/env node
/**
 * validate-live-infrastructure-convergence.mjs
 *
 * Validates structural integrity of the Nzila Live Infrastructure Convergence
 * corpus under docs/nzila-infrastructure-convergence/.
 *
 * Exit code 0 = pass; 1 = fail.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const infraDir = join(repoRoot, 'docs', 'nzila-infrastructure-convergence');

const REQUIRED_DOCS = [
  'README.md',
  'live-infrastructure-discovery.md',
  'environment-isolation-implementation.md',
  'full-domain-url-convergence.md',
  'full-deployment-parity-convergence.md',
  'full-database-migration-legitimacy.md',
  'full-pilot-mode-feature-flag-convergence.md',
  'full-persona-auth-reality-convergence.md',
  'full-live-e2e-certification.md',
  'full-release-rollback-legitimacy.md',
  'full-production-readiness-hardening.md',
  'final-live-infrastructure-certification.md',
];

const REQUIRED_SECTIONS = {
  'final-live-infrastructure-certification.md': [
    'Environment Matrix',
    'URL Matrix',
    'Release Matrix',
    'Auth Matrix',
    'E2E Matrix',
    'Rollback Matrix',
    'Unresolved Risks',
    'Per-tier Operational Verdicts',
  ],
};

const REQUIRED_TIER_KEYWORDS_IN_FINAL = ['DEV', 'STAGING', 'DEMO', 'PILOT', 'PROD'];
const VALID_TIER_VERDICTS = ['GO', 'CONDITIONAL GO', 'NO-GO'];

const HONESTY_MARKERS = [
  'LIVE', 'STAGING-ONLY', 'RESERVED', 'DEFERRED', 'PARTIAL',
  'MOCKED', 'SIMULATED', 'BLOCKED', 'MISSING',
];

const errors = [];
const warnings = [];

function checkDirExists() {
  if (!existsSync(infraDir)) {
    errors.push(`Infrastructure corpus directory missing: ${infraDir}`);
    return false;
  }
  return true;
}

function checkRequiredDocs() {
  for (const doc of REQUIRED_DOCS) {
    const fp = join(infraDir, doc);
    if (!existsSync(fp)) {
      errors.push(`Required infra doc missing: docs/nzila-infrastructure-convergence/${doc}`);
      continue;
    }
    const content = readFileSync(fp, 'utf8');
    if (content.length < 200) {
      errors.push(`Infra doc too short (<200 chars): ${doc}`);
    }
    if (!/^#\s+/m.test(content)) {
      errors.push(`Infra doc missing top-level heading: ${doc}`);
    }
    if (doc !== 'README.md') {
      const markerHit = HONESTY_MARKERS.some((m) =>
        new RegExp(`\\b${m}\\b`).test(content),
      );
      if (!markerHit) {
        errors.push(
          `Infra doc lacks any operational honesty marker: ${doc}`,
        );
      }
      if (!/Authority\s*[:*]/i.test(content)) {
        warnings.push(`Infra doc missing 'Authority:' declaration: ${doc}`);
      }
    }
  }
}

function checkRequiredSections() {
  for (const [doc, sections] of Object.entries(REQUIRED_SECTIONS)) {
    const fp = join(infraDir, doc);
    if (!existsSync(fp)) continue;
    const content = readFileSync(fp, 'utf8');
    for (const s of sections) {
      if (!content.includes(s)) {
        errors.push(`Required section "${s}" missing in ${doc}`);
      }
    }
  }
}

function checkFinalCertification() {
  const fp = join(infraDir, 'final-live-infrastructure-certification.md');
  if (!existsSync(fp)) return;
  const content = readFileSync(fp, 'utf8');

  for (const tier of REQUIRED_TIER_KEYWORDS_IN_FINAL) {
    if (!new RegExp(`\\b${tier}\\b`).test(content)) {
      errors.push(`Tier "${tier}" not represented in final certification`);
    }
  }

  // Must contain at least one explicit per-tier verdict (GO / CONDITIONAL GO / NO-GO)
  const verdictHit = VALID_TIER_VERDICTS.some((v) => content.includes(v));
  if (!verdictHit) {
    errors.push(
      `Final certification lacks any of: ${VALID_TIER_VERDICTS.join(' / ')}`,
    );
  }

  // Must contain a final status block
  if (!/NZILA LIVE INFRASTRUCTURE STATUS/i.test(content)) {
    errors.push(
      `Final certification missing "NZILA LIVE INFRASTRUCTURE STATUS" block`,
    );
  }

  // Must enumerate unresolved risks
  if (!/Unresolved Risks/i.test(content)) {
    errors.push(`Final certification missing "Unresolved Risks" section`);
  }

  // Honest gate: if final claims FULL GO in the status block, it must NOT
  // have HIGH severity unresolved risks.
  const statusBlockMatch = content.match(
    /NZILA LIVE INFRASTRUCTURE STATUS:\s*([A-Z\- ]+)/i,
  );
  const statusVerdict = statusBlockMatch ? statusBlockMatch[1].trim() : null;
  const claimsFullGo = statusVerdict === 'FULL GO';
  const hasHighRisks = /\bHIGH\b/.test(content);
  if (claimsFullGo && hasHighRisks) {
    errors.push(
      `Final certification status block claims FULL GO but enumerates HIGH-severity unresolved risks — verdict is operationally inconsistent`,
    );
  }
}

function checkReadmeIndex() {
  const fp = join(infraDir, 'README.md');
  if (!existsSync(fp)) return;
  const content = readFileSync(fp, 'utf8');
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
  out.push('Nzila Live Infrastructure Convergence — Validation Report');
  out.push('='.repeat(60));
  out.push(`Infra directory: ${infraDir}`);
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
    out.push('');
    out.push('Note: PASS indicates structural integrity of the corpus.');
    out.push('Per-tier operational verdicts (GO / CONDITIONAL GO / NO-GO)');
    out.push('are defined in final-live-infrastructure-certification.md and');
    out.push('reflect live infrastructure reality, NOT validator output.');
  }
  out.push('');
  return out.join('\n');
}

function main() {
  if (checkDirExists()) {
    checkRequiredDocs();
    checkRequiredSections();
    checkFinalCertification();
    checkReadmeIndex();
  }
  process.stdout.write(report());
  process.exit(errors.length === 0 ? 0 : 1);
}

main();
