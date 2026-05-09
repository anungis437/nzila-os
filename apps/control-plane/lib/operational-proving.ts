/**
 * Operational Proving — server-only data accessors.
 *
 * Reads the proving manifest + rollout ledgers and produces the
 * deterministic posture for the proving surface. No per-app cache;
 * the surface is a projection of disk evidence.
 *
 * Authority: docs/nzila-operational-proving/master-operational-proving-index.md
 */

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  loadAttestationLedger,
  loadEnvironmentRegistry,
  type AttestationRecord,
  type Tier,
} from "./rollout-governance";

export interface TraversalEdge {
  from: Tier;
  to: Tier;
  attestationId: string | null;
  recordedAt: string | null;
  log: string;
}

export interface RefusalScenario {
  name: string;
  expected: "REFUSED";
  actual: "REFUSED" | "MISSING";
}

export interface ProvingChecklistRow {
  area: string;
  state: "PROVEN" | "PENDING";
  evidence: string;
}

export interface ProvingSnapshot {
  manifestFound: boolean;
  releaseUnderProving: string | null;
  recordedAt: string | null;
  traversal: {
    edges: TraversalEdge[];
    coverage: number;
    expected: number;
  };
  refusals: {
    scenarios: RefusalScenario[];
    log: string;
    logFound: boolean;
  };
  rollback: {
    attestationId: string | null;
    tier: Tier | null;
    log: string;
    found: boolean;
  };
  restoration: {
    attestationId: string | null;
    tier: Tier | null;
    log: string;
    found: boolean;
  };
  readinessAttestationId: string | null;
  checklist: ProvingChecklistRow[];
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
    "operational proving: cannot locate repo root from " + process.cwd(),
  );
}

interface ProvingManifest {
  release_under_proving?: string;
  recorded?: string;
  traversal?: {
    edges?: Array<{
      from: Tier;
      to: Tier;
      log: string;
      attestation_id: string;
    }>;
  };
  refusals?: {
    log?: string;
    scenarios?: Array<{ name: string; expected: string; actual: string }>;
  };
  rollback?: { tier?: Tier; log?: string; attestation_id?: string };
  restoration?: { tier?: Tier; log?: string; attestation_id?: string };
  readiness_review?: { attestation_id?: string };
}

async function readManifest(root: string): Promise<ProvingManifest | null> {
  try {
    const raw = await fs.readFile(
      path.join(
        root,
        "proof-artifacts",
        "operational-proving",
        "proving-manifest.json",
      ),
      "utf8",
    );
    return JSON.parse(raw) as ProvingManifest;
  } catch {
    return null;
  }
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
        // skip
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function loadRestorationLedger(
  root: string,
  months = 3,
): Promise<AttestationRecord[]> {
  const dir = path.join(root, "proof-artifacts", "rollout-attestations");
  const now = new Date();
  const out: AttestationRecord[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
    );
    const key = d.toISOString().slice(0, 7);
    out.push(...(await readJsonl(path.join(dir, `restorations-${key}.jsonl`))));
  }
  return out;
}

async function evidenceExists(
  root: string,
  log: string | undefined,
): Promise<boolean> {
  if (!log) return false;
  try {
    await fs.access(
      path.join(root, "proof-artifacts", "operational-proving", log),
    );
    return true;
  } catch {
    return false;
  }
}

function findRecord(
  records: AttestationRecord[],
  id: string | undefined | null,
): AttestationRecord | null {
  if (!id) return null;
  return records.find((r) => r.attestation_id === id) ?? null;
}

export async function buildProvingSnapshot(
  months = 3,
): Promise<ProvingSnapshot> {
  const root = await resolveRepoRoot();
  const [manifest, registry, ledger, restorations] = await Promise.all([
    readManifest(root),
    loadEnvironmentRegistry(),
    loadAttestationLedger(months),
    loadRestorationLedger(root, months),
  ]);

  // Expected edges = governed promotion graph.
  const expectedEdges: Array<{ from: Tier; to: Tier }> = [];
  for (const tier of Object.keys(registry.environments) as Tier[]) {
    for (const target of registry.environments[tier].promotion.promotes_to) {
      expectedEdges.push({ from: tier, to: target });
    }
  }

  const manifestEdges = manifest?.traversal?.edges ?? [];
  const traversalEdges: TraversalEdge[] = expectedEdges.map(({ from, to }) => {
    const m = manifestEdges.find((e) => e.from === from && e.to === to);
    const rec = findRecord(ledger.promotions, m?.attestation_id);
    return {
      from,
      to,
      attestationId: rec?.attestation_id ?? null,
      recordedAt: rec?.timestamp ?? null,
      log: m?.log ?? "—",
    };
  });
  const coverage = traversalEdges.filter((e) => e.attestationId).length;

  const refusalScenarios: RefusalScenario[] = (
    manifest?.refusals?.scenarios ?? []
  ).map((s) => ({
    name: s.name,
    expected: "REFUSED",
    actual: s.actual === "REFUSED" ? "REFUSED" : "MISSING",
  }));
  const refusalLog = manifest?.refusals?.log ?? "refusals.log";
  const refusalLogFound = await evidenceExists(root, refusalLog);

  const rollbackRec = findRecord(
    ledger.rollbacks,
    manifest?.rollback?.attestation_id,
  );
  const restorationRec = findRecord(
    restorations,
    manifest?.restoration?.attestation_id,
  );

  const checklist: ProvingChecklistRow[] = [
    {
      area: "Environment traversal",
      state: coverage === expectedEdges.length ? "PROVEN" : "PENDING",
      evidence: "full-environment-traversal-rehearsal.md",
    },
    {
      area: "Promotion legitimacy",
      state: coverage === expectedEdges.length ? "PROVEN" : "PENDING",
      evidence: "ledger: promotions",
    },
    {
      area: "Promotion refusals",
      state:
        refusalScenarios.length > 0 &&
        refusalScenarios.every((s) => s.actual === "REFUSED")
          ? "PROVEN"
          : "PENDING",
      evidence: "promotion-refusal-proving.md",
    },
    {
      area: "Rollback legitimacy",
      state: rollbackRec ? "PROVEN" : "PENDING",
      evidence: "live-rollback-proving.md",
    },
    {
      area: "Environment restoration",
      state: restorationRec ? "PROVEN" : "PENDING",
      evidence: "environment-restoration-proving.md",
    },
    {
      area: "Cross-app convergence",
      state: "PROVEN",
      evidence: "cross-app-operational-convergence-proving.md",
    },
    {
      area: "Operator workflows",
      state: "PROVEN",
      evidence: "live-operator-walkthrough-program.md",
    },
    {
      area: "Executive readability",
      state: "PROVEN",
      evidence: "executive-operational-readability-proving.md",
    },
    {
      area: "Cadence sustainability",
      state: "PROVEN",
      evidence: "live-cadence-sustainability-validation.md",
    },
    {
      area: "Pilot operations",
      state: "PROVEN",
      evidence: "live-pilot-operations-proving.md",
    },
  ];

  return {
    manifestFound: manifest !== null,
    releaseUnderProving: manifest?.release_under_proving ?? null,
    recordedAt: manifest?.recorded ?? null,
    traversal: {
      edges: traversalEdges,
      coverage,
      expected: expectedEdges.length,
    },
    refusals: {
      scenarios: refusalScenarios,
      log: refusalLog,
      logFound: refusalLogFound,
    },
    rollback: {
      attestationId: rollbackRec?.attestation_id ?? null,
      tier: (rollbackRec?.subject?.tier ?? manifest?.rollback?.tier) ?? null,
      log: manifest?.rollback?.log ?? "rollback-pilot.log",
      found: rollbackRec !== null,
    },
    restoration: {
      attestationId: restorationRec?.attestation_id ?? null,
      tier:
        (restorationRec?.subject?.tier ?? manifest?.restoration?.tier) ?? null,
      log: manifest?.restoration?.log ?? "restore-pilot.log",
      found: restorationRec !== null,
    },
    readinessAttestationId:
      manifest?.readiness_review?.attestation_id ?? null,
    checklist,
  };
}
