#!/usr/bin/env node
/**
 * Promotion Attestation Recorder
 *
 * Records a governed promotion event to the rollout attestation
 * ledger. Refuses out-of-graph promotions and promotions inside an
 * open continuity window for the target tier.
 *
 * Authority: docs/nzila-rollout-governance/environment-promotion-governance.md
 *           docs/nzila-rollout-governance/foundations/rollout-attestation-fabric.md
 *
 * Usage:
 *   pnpm rollout:promote:attest -- \
 *     --from staging --to demo --release-id R-2026-05-09-01 \
 *     --reviewer alice --reason "Phase A complete; demo schema legitimacy pending"
 *
 * Optional:
 *   --git-sha <sha>           (defaults to git rev-parse HEAD)
 *   --legitimacy-ref <path>   (link to legitimacy review record)
 *   --override-continuity     (refused unless --override-reason is non-trivial)
 *   --override-reason <text>
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
  process.stderr.write(`[promote:attest] ERROR ${msg}\n`);
  process.exit(1);
}
function info(msg) {
  process.stdout.write(`[promote:attest] ${msg}\n`);
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

for (const required of ['from', 'to', 'release-id', 'reviewer', 'reason']) {
  if (!args[required]) fail(`--${required} is required`);
}
if (typeof args.reason !== 'string' || args.reason.trim().length < 8) {
  fail('--reason must be a non-trivial string (>= 8 chars)');
}

if (!fs.existsSync(registryPath)) fail('environments registry missing');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

const fromEnv = registry.environments[args.from];
const toEnv = registry.environments[args.to];
if (!fromEnv) fail(`unknown --from tier: ${args.from}`);
if (!toEnv) fail(`unknown --to tier: ${args.to}`);

const allowed = fromEnv.promotion?.promotes_to ?? [];
if (!allowed.includes(args.to)) {
  fail(`promotion ${args.from} → ${args.to} is not in the governed promotion graph (allowed: ${allowed.join(', ') || 'none'})`);
}

// Continuity window check: scan recent promotion attestations for this tier.
const month = new Date().toISOString().slice(0, 7);
const ledgerPath = path.join(ledgerDir, `promotions-${month}.jsonl`);
fs.mkdirSync(ledgerDir, { recursive: true });

const windowMin = Number(toEnv.continuity_window_minutes ?? 0);
if (windowMin > 0 && fs.existsSync(ledgerPath)) {
  const recent = fs
    .readFileSync(ledgerPath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter((r) => r && r.subject?.tier === args.to);
  const cutoff = Date.now() - windowMin * 60_000;
  const open = recent.find((r) => Date.parse(r.timestamp) >= cutoff);
  if (open) {
    if (args['override-continuity']) {
      const reason = args['override-reason'];
      if (typeof reason !== 'string' || reason.trim().length < 16) {
        fail('continuity override requires --override-reason (>= 16 chars)');
      }
      info(`continuity window override accepted (reason recorded)`);
    } else {
      fail(
        `tier ${args.to} is inside open continuity window (${windowMin}m, last promotion ${open.timestamp}). ` +
          `Refused per continuity-safe-rollout-system.md.`
      );
    }
  }
}

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
  attestation_type: 'promotion',
  timestamp: new Date().toISOString(),
  actor: args.reviewer,
  subject: {
    tier: args.to,
    from_tier: args.from,
    release_id: args['release-id'],
    git_sha: gitSha,
  },
  outcome: 'RECORDED',
  payload: {
    reason: args.reason,
    legitimacy_review_ref: args['legitimacy-ref'] ?? null,
    continuity_window_minutes: windowMin,
    continuity_window_override: Boolean(args['override-continuity']),
    continuity_window_override_reason: args['override-reason'] ?? null,
  },
  lineage: { parent_attestation_id: null },
};

fs.appendFileSync(ledgerPath, JSON.stringify(attestation) + '\n');
info(`recorded ${attestation.attestation_id} → ${ledgerPath}`);
process.stdout.write(JSON.stringify(attestation, null, 2) + '\n');
