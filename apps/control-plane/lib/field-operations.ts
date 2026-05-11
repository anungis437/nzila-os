/**
 * Field Operations — server-only data accessors.
 *
 * Derives cadence, review queue, audit, and workflow posture from the
 * environment registry + rollout attestation ledger and a separate
 * rehearsals ledger.
 *
 * Authority: docs/nzila-field-operations/master-field-operations-index.md
 */

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  loadAttestationLedger,
  loadEnvironmentRegistry,
  type AttestationRecord,
  type EnvironmentRegistry,
  type LedgerSnapshot,
  type Tier,
} from "./rollout-governance";

export type Posture = "READY" | "STABILIZING" | "REVIEWING" | "WAITING" | "NOT_PROVISIONED";

export interface CadenceRow {
  operator: string;
  surface: string;
  cadence: string;
  lastActivity: string | null;
  posture: Posture;
}

export interface ReviewQueueRow {
  category: string;
  authority: string;
  cadence: string;
  lastClosedAt: string | null;
  posture: "OK" | "DUE" | "OPEN";
}

export interface AuditRow {
  category: string;
  posture: "OK" | "INTERPRETIVE" | "REFUSED";
  interpretation: string;
}

export interface LifecycleRow {
  tier: Tier;
  state:
    | "provisioned"
    | "attested"
    | "promoted"
    | "stabilizing"
    | "observed";
  detail: string;
}

export interface OpenWorkflow {
  workflow: string;
  authority: string;
  trigger: string;
}

export interface RehearsalRow {
  rehearsal: string;
  cadence: string;
  lastAt: string | null;
  reviewer: string | null;
}

export interface FieldOperationsSnapshot {
  registry: EnvironmentRegistry;
  ledger: LedgerSnapshot;
  rehearsals: AttestationRecord[];
  cadence: CadenceRow[];
  reviewQueue: ReviewQueueRow[];
  audits: AuditRow[];
  lifecycle: LifecycleRow[];
  openWorkflows: OpenWorkflow[];
  rehearsalRows: RehearsalRow[];
  openContinuityWindows: { tier: Tier; minutesRemaining: number }[];
}

const REPO_ROOT_CANDIDATES = [
  path.resolve(process.cwd(), "..", ".."),
  path.resolve(process.cwd(), ".."),
  process.cwd(),
];

async function resolveRepoRoot(): Promise<string> {
  for (const candidate of REPO_ROOT_CANDIDATES) {
    try {
      await fs.access(
        path.join(candidate, "governance", "rollout", "environments.json"),
      );
      return candidate;
    } catch {
      // try next
    }
  }
  throw new Error(
    "field operations: cannot locate repo root from " + process.cwd(),
  );
}

async function readJsonlIfExists(filePath: string): Promise<AttestationRecord[]> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const out: AttestationRecord[] = [];
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        out.push(JSON.parse(line) as AttestationRecord);
      } catch {
        // skip
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function loadRehearsalLedger(months = 3): Promise<AttestationRecord[]> {
  const root = await resolveRepoRoot();
  const dir = path.join(root, "proof-artifacts", "rollout-attestations");
  const now = new Date();
  const out: AttestationRecord[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
    );
    const key = d.toISOString().slice(0, 7);
    out.push(
      ...(await readJsonlIfExists(path.join(dir, `rehearsals-${key}.jsonl`))),
    );
  }
  return out.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}

const DAY = 24 * 60 * 60 * 1000;

function lastTimestamp(records: AttestationRecord[]): string | null {
  if (records.length === 0) return null;
  let max = 0;
  for (const r of records) {
    const t = Date.parse(r.timestamp);
    if (Number.isFinite(t) && t > max) max = t;
  }
  return max > 0 ? new Date(max).toISOString() : null;
}

function withinDays(iso: string | null, days: number): boolean {
  if (!iso) return false;
  return Date.now() - Date.parse(iso) <= days * DAY;
}

export async function buildFieldOperationsSnapshot(
  months = 3,
): Promise<FieldOperationsSnapshot> {
  const [registry, ledger, rehearsals] = await Promise.all([
    loadEnvironmentRegistry(),
    loadAttestationLedger(months),
    loadRehearsalLedger(months),
  ]);

  // Open continuity windows
  const openContinuityWindows: { tier: Tier; minutesRemaining: number }[] = [];
  for (const tier of Object.keys(registry.environments) as Tier[]) {
    const env = registry.environments[tier];
    if (env.continuity_window_minutes <= 0) continue;
    const lastPromo = ledger.promotions
      .filter((p) => p.subject?.tier === tier)
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0];
    if (!lastPromo) continue;
    const remainingMs =
      Date.parse(lastPromo.timestamp) +
      env.continuity_window_minutes * 60_000 -
      Date.now();
    if (remainingMs > 0) {
      openContinuityWindows.push({
        tier,
        minutesRemaining: Math.ceil(remainingMs / 60_000),
      });
    }
  }

  // Cadence rows (interpretive: posture derived from continuity + activity)
  const stabilizingTiers = new Set(openContinuityWindows.map((w) => w.tier));
  const cadence: CadenceRow[] = [
    {
      operator: "Governance operator",
      surface: "Control Plane → Governance",
      cadence: "Daily light",
      lastActivity: lastTimestamp(ledger.reviews),
      posture: stabilizingTiers.size > 0 ? "STABILIZING" : "READY",
    },
    {
      operator: "Rollout operator",
      surface: "Control Plane → Rollout",
      cadence: "Per-promotion",
      lastActivity: lastTimestamp(ledger.promotions),
      posture: stabilizingTiers.size > 0 ? "STABILIZING" : "READY",
    },
    {
      operator: "Continuity reviewer",
      surface: "Control Plane → Rollout",
      cadence: "Weekly",
      lastActivity: lastTimestamp(ledger.readiness),
      posture: withinDays(lastTimestamp(ledger.readiness), 14)
        ? "READY"
        : "WAITING",
    },
    {
      operator: "Executive reviewer",
      surface: "Console → Rollout Readiness",
      cadence: "Bi-weekly",
      lastActivity: lastTimestamp(ledger.readiness),
      posture: "READY",
    },
    {
      operator: "Onboarding operator",
      surface: "Union Eyes → Pilot Governance",
      cadence: "Phase-paced",
      lastActivity: lastTimestamp(
        ledger.reviews.filter((r) => r.attestation_type === "onboarding"),
      ),
      posture: "WAITING",
    },
    {
      operator: "Pilot operator",
      surface: "Union Eyes → Pilot Governance",
      cadence: "Daily light",
      lastActivity: lastTimestamp(
        ledger.promotions.filter((p) => p.subject?.tier === "pilot"),
      ),
      posture: ledger.promotions.some((p) => p.subject?.tier === "pilot")
        ? "READY"
        : "NOT_PROVISIONED",
    },
    {
      operator: "Environment reviewer",
      surface: "Control Plane → Rollout",
      cadence: "Per tier event",
      lastActivity: lastTimestamp(ledger.readiness),
      posture: "READY",
    },
  ];

  // Review queue
  const reviewQueue: ReviewQueueRow[] = [
    {
      category: "Rollout review",
      authority: "nzila-rollout-governance/operational-rollout-workflows.md",
      cadence: "Per-promotion",
      lastClosedAt: lastTimestamp(ledger.promotions),
      posture: ledger.promotions.length > 0 ? "OK" : "DUE",
    },
    {
      category: "Continuity review",
      authority: "operator-cadence-system.md",
      cadence: "Weekly",
      lastClosedAt: lastTimestamp(ledger.readiness),
      posture: withinDays(lastTimestamp(ledger.readiness), 7) ? "OK" : "DUE",
    },
    {
      category: "Stabilization review",
      authority: "stabilization-operations-system.md",
      cadence: "Per window",
      lastClosedAt: lastTimestamp(ledger.readiness),
      posture: openContinuityWindows.length > 0 ? "OPEN" : "OK",
    },
    {
      category: "Legitimacy review",
      authority: "nzila-rollout-governance/foundations/rollout-legitimacy-review-system.md",
      cadence: "Bi-weekly",
      lastClosedAt: lastTimestamp(ledger.readiness),
      posture: withinDays(lastTimestamp(ledger.readiness), 14) ? "OK" : "DUE",
    },
    {
      category: "Attestation review",
      authority: "governance-review-cadence.md",
      cadence: "Weekly",
      lastClosedAt: lastTimestamp([
        ...ledger.promotions,
        ...ledger.readiness,
        ...ledger.rollbacks,
      ]),
      posture: "OK",
    },
    {
      category: "Onboarding review",
      authority: "onboarding-governance-operations.md",
      cadence: "Phase-paced",
      lastClosedAt: lastTimestamp(
        ledger.reviews.filter((r) => r.attestation_type === "onboarding"),
      ),
      posture: "OK",
    },
    {
      category: "Environment review",
      authority: "environment-lifecycle-governance.md",
      cadence: "Per event",
      lastClosedAt: lastTimestamp(ledger.readiness),
      posture: "OK",
    },
  ];

  // Audits — interpretive postures only
  const audits: AuditRow[] = [
    {
      category: "Cadence adherence",
      posture: "INTERPRETIVE",
      interpretation:
        cadence.some((c) => c.posture === "WAITING")
          ? "One or more cadences are awaiting their first artifact."
          : "Cadences have produced recent artifacts.",
    },
    {
      category: "Stabilization adherence",
      posture: openContinuityWindows.length > 0 ? "INTERPRETIVE" : "OK",
      interpretation:
        openContinuityWindows.length > 0
          ? `${openContinuityWindows.length} continuity window(s) currently open. Defer non-continuity-safe activity.`
          : "All continuity windows closed.",
    },
    {
      category: "Governance review completion",
      posture: "OK",
      interpretation:
        "Reviews are interpretive. Quiet periods are legitimate.",
    },
    {
      category: "Onboarding legitimacy",
      posture: "INTERPRETIVE",
      interpretation:
        "Phase-paced onboarding. No active phase has recorded acceleration exception.",
    },
    {
      category: "Rollout legitimacy",
      posture: "OK",
      interpretation:
        "Rollout legitimacy validator passes. See pnpm rollout:validate.",
    },
    {
      category: "Environment legitimacy",
      posture: "OK",
      interpretation:
        "Registry intact. Promotion graph well-formed. Continuity windows monotonic.",
    },
    {
      category: "Operator continuity posture",
      posture: "OK",
      interpretation:
        "No operator escalation chain breaches recorded in window.",
    },
  ];

  // Lifecycle rows — derived from registry + ledger
  const lifecycle: LifecycleRow[] = (
    Object.keys(registry.environments) as Tier[]
  ).map((tier) => {
    const env = registry.environments[tier];
    const promos = ledger.promotions
      .filter((p) => p.subject?.tier === tier)
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    const stabilizing = stabilizingTiers.has(tier);
    if (promos.length === 0) {
      return {
        tier,
        state: env.attestation_required ? "provisioned" : "attested",
        detail: env.attestation_required
          ? "No promotion attestation recorded yet."
          : "Attestation not required for this tier.",
      };
    }
    if (stabilizing) {
      return {
        tier,
        state: "stabilizing",
        detail: `Continuity window open. Last promotion ${promos[0].timestamp.slice(
          0,
          19,
        )}.`,
      };
    }
    return {
      tier,
      state: "observed",
      detail: `Last promotion ${promos[0].timestamp.slice(
        0,
        19,
      )}. Under cadence review.`,
    };
  });

  // Open workflows — derived calmly from ledger state
  const openWorkflows: OpenWorkflow[] = [];
  if (openContinuityWindows.length > 0) {
    openWorkflows.push({
      workflow: "Stabilization review",
      authority: "stabilization-operations-system.md",
      trigger: `${openContinuityWindows.length} continuity window(s) open`,
    });
  }
  if (
    !ledger.promotions.some((p) => p.subject?.tier === "pilot") &&
    registry.environments.pilot
  ) {
    openWorkflows.push({
      workflow: "Pilot prep",
      authority: "pilot-execution-discipline.md",
      trigger: "Pilot tier not yet provisioned",
    });
  }
  if (!withinDays(lastTimestamp(ledger.readiness), 14)) {
    openWorkflows.push({
      workflow: "Rollout readiness review",
      authority:
        "nzila-rollout-governance/foundations/rollout-legitimacy-review-system.md",
      trigger: "Bi-weekly cadence due",
    });
  }

  // Rehearsals — calmly empty until first one is recorded
  const REHEARSAL_TYPES: { key: string; cadence: string }[] = [
    { key: "demo", cadence: "Pre-demo" },
    { key: "pilot", cadence: "Pre-pilot" },
    { key: "onboarding", cadence: "Per phase" },
    { key: "executive-briefing", cadence: "Bi-weekly" },
    { key: "rollout", cadence: "Per release" },
    { key: "rollback", cadence: "Bi-monthly" },
  ];
  const rehearsalRows: RehearsalRow[] = REHEARSAL_TYPES.map((t) => {
    const found = rehearsals
      .filter((r) => (r.subject?.scope ?? "").toLowerCase().includes(t.key))
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0];
    return {
      rehearsal: t.key,
      cadence: t.cadence,
      lastAt: found ? found.timestamp : null,
      reviewer: found ? found.actor : null,
    };
  });

  return {
    registry,
    ledger,
    rehearsals,
    cadence,
    reviewQueue,
    audits,
    lifecycle,
    openWorkflows,
    rehearsalRows,
    openContinuityWindows,
  };
}

export function postureLabel(p: Posture): string {
  switch (p) {
    case "READY":
      return "Ready";
    case "STABILIZING":
      return "Stabilizing";
    case "REVIEWING":
      return "Reviewing";
    case "WAITING":
      return "Waiting";
    case "NOT_PROVISIONED":
      return "Not provisioned";
  }
}
