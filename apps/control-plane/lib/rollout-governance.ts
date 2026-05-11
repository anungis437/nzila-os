/**
 * Rollout Governance — server-only data accessors.
 *
 * Reads the canonical environment registry and the rollout attestation
 * ledger from the repository root.
 *
 * Authority: docs/nzila-rollout-governance/master-rollout-governance-index.md
 */

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

export type Tier = "local" | "dev" | "staging" | "demo" | "pilot" | "prod";

export interface EnvironmentRecord {
  tier: Tier;
  purpose: string;
  topology: string;
  secret_topology: string;
  shared_secret_topology_exception?: string;
  promotion: { promotes_to: Tier[]; promotes_from: Tier[] };
  attestation_required: boolean;
  snapshot_source: string;
  operator_review: string;
  rollback_policy: string;
  continuity_window_minutes: number;
}

export interface EnvironmentRegistry {
  version: string;
  effective: string;
  authority: string;
  environments: Record<Tier, EnvironmentRecord>;
}

export interface AttestationRecord {
  attestation_id: string;
  attestation_type:
    | "promotion"
    | "review"
    | "readiness"
    | "rollback"
    | "session"
    | "onboarding";
  timestamp: string;
  actor: string;
  subject: {
    tier?: Tier;
    from_tier?: Tier;
    release_id?: string;
    git_sha?: string;
    scope?: string;
  };
  outcome: "PASS" | "PASS-WITH-CONDITIONS" | "HOLD" | "REFUSE" | "RECORDED";
  payload: Record<string, unknown>;
  lineage: { parent_attestation_id: string | null };
}

const REPO_ROOT_CANDIDATES = [
  path.resolve(process.cwd(), "..", ".."),
  path.resolve(process.cwd(), ".."),
  process.cwd(),
];

async function resolveRepoRoot(): Promise<string> {
  for (const candidate of REPO_ROOT_CANDIDATES) {
    try {
      await fs.access(path.join(candidate, "governance", "rollout", "environments.json"));
      return candidate;
    } catch {
      // try next
    }
  }
  throw new Error("rollout governance: cannot locate repo root from " + process.cwd());
}

export async function loadEnvironmentRegistry(): Promise<EnvironmentRegistry> {
  const root = await resolveRepoRoot();
  const raw = await fs.readFile(
    path.join(root, "governance", "rollout", "environments.json"),
    "utf8",
  );
  return JSON.parse(raw) as EnvironmentRegistry;
}

async function readJsonl(filePath: string): Promise<AttestationRecord[]> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const out: AttestationRecord[] = [];
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        out.push(JSON.parse(line) as AttestationRecord);
      } catch {
        // skip malformed line; ledger remains read-side tolerant
      }
    }
    return out;
  } catch {
    return [];
  }
}

export interface LedgerSnapshot {
  promotions: AttestationRecord[];
  readiness: AttestationRecord[];
  rollbacks: AttestationRecord[];
  reviews: AttestationRecord[];
  sessions: AttestationRecord[];
}

export async function loadAttestationLedger(months = 3): Promise<LedgerSnapshot> {
  const root = await resolveRepoRoot();
  const dir = path.join(root, "proof-artifacts", "rollout-attestations");
  const now = new Date();
  const monthKeys: string[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    monthKeys.push(d.toISOString().slice(0, 7));
  }

  const kinds = ["promotions", "readiness", "rollbacks", "reviews", "sessions"] as const;
  const result: LedgerSnapshot = {
    promotions: [],
    readiness: [],
    rollbacks: [],
    reviews: [],
    sessions: [],
  };
  for (const kind of kinds) {
    for (const month of monthKeys) {
      const records = await readJsonl(path.join(dir, `${kind}-${month}.jsonl`));
      result[kind].push(...records);
    }
    result[kind].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  }
  return result;
}

export interface TierPosture {
  tier: Tier;
  env: EnvironmentRecord;
  lastPromotion: AttestationRecord | null;
  continuityWindow: { minutes: number; openMinutesRemaining: number };
  lastRollback: AttestationRecord | null;
  recentPromotionCount: number;
}

export function buildTierPostures(
  registry: EnvironmentRegistry,
  ledger: LedgerSnapshot,
): TierPosture[] {
  const tiers: Tier[] = ["dev", "staging", "demo", "pilot", "prod"];
  const now = Date.now();
  return tiers.map((tier) => {
    const env = registry.environments[tier];
    const lastPromotion =
      ledger.promotions.find((p) => p.subject?.tier === tier) ?? null;
    const lastRollback =
      ledger.rollbacks.find((r) => r.subject?.tier === tier) ?? null;
    const recentPromotionCount = ledger.promotions.filter(
      (p) =>
        p.subject?.tier === tier &&
        Date.parse(p.timestamp) >= now - 30 * 24 * 60 * 60_000,
    ).length;

    let openMinutesRemaining = 0;
    if (lastPromotion && env.continuity_window_minutes > 0) {
      const remainingMs =
        Date.parse(lastPromotion.timestamp) +
        env.continuity_window_minutes * 60_000 -
        now;
      if (remainingMs > 0) openMinutesRemaining = Math.ceil(remainingMs / 60_000);
    }

    return {
      tier,
      env,
      lastPromotion,
      lastRollback,
      recentPromotionCount,
      continuityWindow: {
        minutes: env.continuity_window_minutes,
        openMinutesRemaining,
      },
    };
  });
}

export function tierPostureLabel(p: TierPosture): {
  state: "current" | "stale" | "warning" | "missing";
  text: string;
} {
  if (!p.lastPromotion) return { state: "missing", text: "No attestation in window" };
  if (p.continuityWindow.openMinutesRemaining > 0) {
    return {
      state: "warning",
      text: `Stabilizing — ${p.continuityWindow.openMinutesRemaining}m`,
    };
  }
  return { state: "current", text: "Attested" };
}
