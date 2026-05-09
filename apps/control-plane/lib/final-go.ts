/**
 * Final GO Status — server-only data accessors.
 *
 * Reads the finalization manifest + per-environment certifications +
 * convergence/legitimacy audits and produces the deterministic
 * posture for the Final GO Status surface.
 *
 * Authority: docs/nzila-finalization/master-finalization-index.md
 */

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Tier } from "./rollout-governance";

export interface CertificationArea {
  area: string;
  state: "PROVEN" | "N/A" | "PENDING";
  evidence: string;
}

export interface EnvironmentCertification {
  tier: Tier;
  verdict: "GO" | "HOLD" | "NO-GO";
  issued: string;
  release: string;
  areas: CertificationArea[];
  anchors: Record<string, string>;
}

export interface ConvergenceAxis {
  axis: string;
  result: "STRONG" | "MODERATE" | "WEAK";
  note: string;
}

export interface LegitimacyAudit {
  domain: string;
  verdict: "PASS" | "HOLD" | "FAIL";
  interpretation: string;
}

export interface FinalGoSnapshot {
  manifestFound: boolean;
  certified: boolean;
  recordedAt: string | null;
  release: string | null;
  certifications: EnvironmentCertification[];
  convergence: ConvergenceAxis[];
  legitimacy: LegitimacyAudit[];
  unresolvedRisks: { risk: string; carry_to: string; mitigation: string }[];
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
  throw new Error("final-go: cannot locate repo root from " + process.cwd());
}

async function readJsonIfExists<T>(p: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(p, "utf8")) as T;
  } catch {
    return null;
  }
}

const TIERS: Tier[] = ["dev", "staging", "demo", "pilot", "prod"];

interface FinalizationManifest {
  recorded?: string;
  release_under_certification?: string;
  certifications?: Record<string, string>;
}

export async function buildFinalGoSnapshot(): Promise<FinalGoSnapshot> {
  const root = await resolveRepoRoot();
  const finalizationDir = path.join(root, "proof-artifacts", "finalization");
  const manifest = await readJsonIfExists<FinalizationManifest>(
    path.join(finalizationDir, "finalization-manifest.json"),
  );

  const certifications: EnvironmentCertification[] = [];
  for (const tier of TIERS) {
    const cert = await readJsonIfExists<{
      tier: Tier;
      verdict: "GO" | "HOLD" | "NO-GO";
      issued: string;
      release_under_certification: string;
      areas: CertificationArea[];
      anchors?: Record<string, string>;
    }>(path.join(finalizationDir, "certifications", `${tier}.json`));
    if (!cert) continue;
    certifications.push({
      tier: cert.tier,
      verdict: cert.verdict,
      issued: cert.issued,
      release: cert.release_under_certification,
      areas: cert.areas,
      anchors: cert.anchors ?? {},
    });
  }

  const convergence =
    (await readJsonIfExists<{ axes?: ConvergenceAxis[] }>(
      path.join(finalizationDir, "convergence-audit.json"),
    ))?.axes ?? [];

  const legitimacyDoc = await readJsonIfExists<{
    audits?: LegitimacyAudit[];
    unresolved_risk_register?: {
      risk: string;
      carry_to: string;
      mitigation: string;
    }[];
  }>(path.join(finalizationDir, "legitimacy-audit.json"));

  const certified =
    certifications.length === TIERS.length &&
    certifications.every((c) => c.verdict === "GO") &&
    convergence.length > 0 &&
    convergence.every((a) => a.result === "STRONG") &&
    Array.isArray(legitimacyDoc?.audits) &&
    (legitimacyDoc?.audits ?? []).every((a) => a.verdict === "PASS");

  return {
    manifestFound: manifest !== null,
    certified,
    recordedAt: manifest?.recorded ?? null,
    release: manifest?.release_under_certification ?? null,
    certifications,
    convergence,
    legitimacy: legitimacyDoc?.audits ?? [],
    unresolvedRisks: legitimacyDoc?.unresolved_risk_register ?? [],
  };
}
