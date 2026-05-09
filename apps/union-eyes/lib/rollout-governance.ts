/**
 * Rollout Governance — server-only data accessors (union-eyes copy).
 *
 * Mirrors apps/control-plane/lib/rollout-governance.ts for the Union
 * Eyes pilot governance surface.
 *
 * Authority: docs/nzila-rollout-governance/master-rollout-governance-index.md
 */

import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export type Tier = 'local' | 'dev' | 'staging' | 'demo' | 'pilot' | 'prod';

export interface EnvironmentRecord {
  tier: Tier;
  topology: string;
  secret_topology: string;
  shared_secret_topology_exception?: string;
  promotion: { promotes_to: Tier[]; promotes_from: Tier[] };
  continuity_window_minutes: number;
  operator_review: string;
  rollback_policy: string;
}

export interface EnvironmentRegistry {
  environments: Record<Tier, EnvironmentRecord>;
}

export interface AttestationRecord {
  attestation_id: string;
  attestation_type: string;
  timestamp: string;
  actor: string;
  subject: { tier?: Tier; from_tier?: Tier; release_id?: string; scope?: string };
  outcome: string;
  payload: Record<string, unknown>;
}

const REPO_ROOT_CANDIDATES = [
  path.resolve(process.cwd(), '..', '..'),
  path.resolve(process.cwd(), '..'),
  process.cwd(),
];

async function resolveRepoRoot(): Promise<string> {
  for (const candidate of REPO_ROOT_CANDIDATES) {
    try {
      await fs.access(path.join(candidate, 'governance', 'rollout', 'environments.json'));
      return candidate;
    } catch {
      // try next
    }
  }
  throw new Error('rollout governance: cannot locate repo root from ' + process.cwd());
}

export async function loadEnvironmentRegistry(): Promise<EnvironmentRegistry> {
  const root = await resolveRepoRoot();
  const raw = await fs.readFile(
    path.join(root, 'governance', 'rollout', 'environments.json'),
    'utf8',
  );
  return JSON.parse(raw) as EnvironmentRegistry;
}

async function readJsonl(filePath: string): Promise<AttestationRecord[]> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const out: AttestationRecord[] = [];
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        out.push(JSON.parse(line) as AttestationRecord);
      } catch {
        // skip malformed line
      }
    }
    return out;
  } catch {
    return [];
  }
}

export interface PilotLedger {
  promotions: AttestationRecord[];
  rollbacks: AttestationRecord[];
}

export async function loadPilotLedger(months = 3): Promise<PilotLedger> {
  const root = await resolveRepoRoot();
  const dir = path.join(root, 'proof-artifacts', 'rollout-attestations');
  const now = new Date();
  const monthKeys: string[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    monthKeys.push(d.toISOString().slice(0, 7));
  }
  const out: PilotLedger = { promotions: [], rollbacks: [] };
  for (const month of monthKeys) {
    out.promotions.push(...(await readJsonl(path.join(dir, `promotions-${month}.jsonl`))));
    out.rollbacks.push(...(await readJsonl(path.join(dir, `rollbacks-${month}.jsonl`))));
  }
  out.promotions = out.promotions.filter((p) => p.subject?.tier === 'pilot');
  out.rollbacks = out.rollbacks.filter((r) => r.subject?.tier === 'pilot');
  out.promotions.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  out.rollbacks.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  return out;
}
