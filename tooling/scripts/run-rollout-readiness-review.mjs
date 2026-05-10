#!/usr/bin/env node
/**
 * Rollout Readiness Review Aggregator
 *
 * Produces a calm, sparse, executive-readable readiness summary across
 * environments based on the registry and the rollout attestation
 * ledger. Records a readiness attestation as a side effect.
 *
 * Authority: docs/nzila-rollout-governance/foundations/rollout-legitimacy-review-system.md
 */

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const registryPath = path.join(repoRoot, 'governance', 'rollout', 'environments.json');
const ledgerDir = path.join(repoRoot, 'proof-artifacts', 'rollout-attestations');

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

const month = new Date().toISOString().slice(0, 7);
const promosPath = path.join(ledgerDir, `promotions-${month}.jsonl`);
const promos = fs.existsSync(promosPath)
  ? fs
      .readFileSync(promosPath, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
  : [];

const tiers = ['dev', 'staging', 'demo', 'pilot', 'prod'];
const lines = [];
lines.push('Rollout Readiness — ' + new Date().toISOString());
lines.push('');
lines.push('Tier      LastPromotion        Release          ContinuityWindow  Posture');
lines.push('--------  -------------------  ---------------  ----------------  --------');

const summary = [];
for (const tier of tiers) {
  const env = registry.environments[tier];
  const tierPromos = promos.filter((p) => p.subject?.tier === tier);
  const last = tierPromos.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0];
  const windowMin = Number(env.continuity_window_minutes ?? 0);
  let windowState = 'closed';
  if (last && windowMin > 0) {
    const remaining = Date.parse(last.timestamp) + windowMin * 60_000 - Date.now();
    if (remaining > 0) {
      windowState = `open (${Math.ceil(remaining / 60_000)}m left)`;
    }
  }
  const posture = last ? 'attested' : 'no attestation in month';
  summary.push({ tier, last_promotion: last?.timestamp ?? null, release_id: last?.subject?.release_id ?? null, continuity_window_state: windowState, posture });
  lines.push(
    [
      tier.padEnd(8),
      (last?.timestamp ?? '—').padEnd(19),
      (last?.subject?.release_id ?? '—').padEnd(15),
      windowState.padEnd(16),
      posture,
    ].join('  ')
  );
}

process.stdout.write(lines.join('\n') + '\n');

// Record readiness attestation
fs.mkdirSync(ledgerDir, { recursive: true });
const readinessPath = path.join(ledgerDir, `readiness-${month}.jsonl`);
const att = {
  attestation_id: crypto.randomUUID(),
  attestation_type: 'readiness',
  timestamp: new Date().toISOString(),
  actor: process.env.USER || process.env.USERNAME || 'system',
  subject: { scope: 'all-tiers' },
  outcome: 'RECORDED',
  payload: { summary },
  lineage: { parent_attestation_id: null },
};
fs.appendFileSync(readinessPath, JSON.stringify(att) + '\n');
process.stdout.write(`\n[readiness] recorded ${att.attestation_id} → ${readinessPath}\n`);
