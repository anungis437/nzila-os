#!/usr/bin/env node
/**
 * Rollback Attestation Recorder
 *
 * Records a governed rollback event to the rollout attestation
 * ledger. A rollback is recorded with the same authority level as
 * the promotion it reverses.
 *
 * Authority: docs/nzila-rollout-governance/governed-rollback-system.md
 *
 * Usage:
 *   pnpm rollout:rollback:attest -- \
 *     --tier pilot --release-id R-2026-05-09-01 \
 *     --reviewer alice --reason "Continuity-safe revert; sponsor co-signed"
 *
 * Optional:
 *   --restore        Record this attestation as a 'restoration' instead of
 *                    a 'rollback'. A restoration re-attests an environment
 *                    after a retirement or major change.
 */

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const registryPath = path.join(repoRoot, 'governance', 'rollout', 'environments.json');
const ledgerDir = path.join(repoRoot, 'proof-artifacts', 'rollout-attestations');

function fail(msg) {
  process.stderr.write(`[rollback:attest] ERROR ${msg}\n`);
  process.exit(1);
}
function info(msg) {
  process.stdout.write(`[rollback:attest] ${msg}\n`);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

for (const required of ['tier', 'release-id', 'reviewer', 'reason']) {
  if (!args[required]) fail(`--${required} is required`);
}
if (typeof args.reason !== 'string' || args.reason.trim().length < 16) {
  fail('--reason must be a non-trivial string (>= 16 chars)');
}

if (!fs.existsSync(registryPath)) fail('environments registry missing');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const env = registry.environments[args.tier];
if (!env) fail(`unknown --tier: ${args.tier}`);

const isRestore = Boolean(args.restore);
const month = new Date().toISOString().slice(0, 7);
const file = isRestore
  ? path.join(ledgerDir, `restorations-${month}.jsonl`)
  : path.join(ledgerDir, `rollbacks-${month}.jsonl`);
fs.mkdirSync(ledgerDir, { recursive: true });

let gitSha = args['git-sha'];
if (!gitSha) {
  try {
    gitSha = execSync('git rev-parse HEAD', { cwd: repoRoot }).toString().trim();
  } catch {
    gitSha = 'unknown';
  }
}

const attestation = {
  attestation_id: crypto.randomUUID(),
  attestation_type: isRestore ? 'restoration' : 'rollback',
  timestamp: new Date().toISOString(),
  actor: args.reviewer,
  subject: {
    tier: args.tier,
    release_id: args['release-id'],
    git_sha: gitSha,
  },
  outcome: 'RECORDED',
  payload: {
    reason: args.reason,
    rollback_policy: env.rollback_policy ?? null,
    continuity_window_minutes: env.continuity_window_minutes ?? 0,
  },
  lineage: { parent_attestation_id: null },
};

fs.appendFileSync(file, JSON.stringify(attestation) + '\n');
info(`recorded ${attestation.attestation_id} → ${file}`);
process.stdout.write(JSON.stringify(attestation, null, 2) + '\n');
