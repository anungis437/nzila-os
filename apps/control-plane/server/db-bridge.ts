/**
 * DB Bridge — Live PostgreSQL queries for control-plane dashboards.
 *
 * Maps Console's audit/governance/evidence data from @nzila/db tables
 * into the shapes expected by control-plane's server/data.ts functions.
 *
 * All queries are read-only and catch errors gracefully.
 */
import "server-only";

import { db } from "@nzila/db";
import {
  auditEvents,
  governanceActions,
  evidencePacks,
} from "@nzila/db";
import {
  platformProofPacks,
  platformCostBudgetBreaches,
} from "@nzila/db";
import { desc, count, eq } from "drizzle-orm";
import type { GovernanceAuditTimelineEntry } from "@nzila/platform-governance/types";
import type { Anomaly } from "@nzila/platform-anomaly-engine/types";

// ── Governance Timeline from audit_events ───────────────

export async function fetchLiveGovernanceTimeline(): Promise<
  GovernanceAuditTimelineEntry[] | null
> {
  try {
    const rows = await db
      .select({
        id: auditEvents.id,
        action: auditEvents.action,
        actor: auditEvents.actorClerkUserId,
        targetType: auditEvents.targetType,
        createdAt: auditEvents.createdAt,
        hash: auditEvents.hash,
      })
      .from(auditEvents)
      .orderBy(desc(auditEvents.createdAt))
      .limit(50);

    if (rows.length === 0) return null;

    return rows.map((r) => ({
      timestamp: r.createdAt.toISOString(),
      event_type: mapActionToEventType(r.action),
      actor: r.actor,
      policy_result: "pass" as const,
      commit_hash: r.hash.slice(0, 7),
      source: `db:${r.targetType}`,
    }));
  } catch {
    return null;
  }
}

function mapActionToEventType(action: string): string {
  if (action.includes("approval") || action.includes("approve"))
    return "approval_granted";
  if (action.includes("compliance") || action.includes("check"))
    return "compliance_check";
  if (action.includes("evidence") || action.includes("export"))
    return "evidence_exported";
  if (action.includes("policy") || action.includes("evaluat"))
    return "policy_evaluated";
  return action;
}

// ── Governance Status from live data ────────────────────

export interface LiveGovernanceMetrics {
  totalAuditEvents: number;
  recentGovernanceActions: number;
  evidencePackCount: number;
  latestProofPack: {
    ciStatus: string;
    secretScanStatus: string;
    generatedAt: Date;
  } | null;
}

export async function fetchLiveGovernanceMetrics(): Promise<LiveGovernanceMetrics | null> {
  try {
    const [auditCount] = await db
      .select({ total: count() })
      .from(auditEvents);

    const [govActionCount] = await db
      .select({ total: count() })
      .from(governanceActions);

    const [evidenceCount] = await db
      .select({ total: count() })
      .from(evidencePacks);

    const proofPacks = await db
      .select({
        ciStatus: platformProofPacks.ciPipelineStatus,
        secretScanStatus: platformProofPacks.secretScanStatus,
        generatedAt: platformProofPacks.generatedAt,
      })
      .from(platformProofPacks)
      .orderBy(desc(platformProofPacks.generatedAt))
      .limit(1);

    return {
      totalAuditEvents: auditCount.total,
      recentGovernanceActions: govActionCount.total,
      evidencePackCount: evidenceCount.total,
      latestProofPack: proofPacks[0]
        ? {
            ciStatus: proofPacks[0].ciStatus,
            secretScanStatus: proofPacks[0].secretScanStatus,
            generatedAt: proofPacks[0].generatedAt,
          }
        : null,
    };
  } catch {
    return null;
  }
}

// ── Cost budget breaches as anomalies ───────────────────

export async function fetchLiveCostAnomalies(): Promise<Anomaly[] | null> {
  try {
    const breaches = await db
      .select()
      .from(platformCostBudgetBreaches)
      .orderBy(desc(platformCostBudgetBreaches.recordedAt))
      .limit(20);

    if (breaches.length === 0) return null;

    return breaches.map((b) => ({
      id: b.id,
      timestamp: b.recordedAt.toISOString(),
      anomalyType: "financial_irregularity" as const,
      severity: b.state === "critical" ? "high" as const : "medium" as const,
      app: "platform",
      metric: "cost_budget_breach",
      expectedValue: 0,
      actualValue: b.dailySpendUsd,
      deviationFactor: b.monthlySpendUsd > 0 ? b.dailySpendUsd / (b.monthlySpendUsd / 30) : 1,
      description: `Budget breach (${b.state}): daily $${b.dailySpendUsd.toFixed(2)}, monthly $${b.monthlySpendUsd.toFixed(2)}`,
      suggestedAction: "Review cost categories and adjust budget or reduce usage.",
    }));
  } catch {
    return null;
  }
}

// ── Evidence pack summary ───────────────────────────────

export interface LiveEvidenceSummary {
  totalPacks: number;
  verifiedPacks: number;
  pendingPacks: number;
  latestVerifiedAt: string | null;
}

export async function fetchLiveEvidenceSummary(): Promise<LiveEvidenceSummary | null> {
  try {
    const [total] = await db.select({ total: count() }).from(evidencePacks);

    const [verified] = await db
      .select({ total: count() })
      .from(evidencePacks)
      .where(eq(evidencePacks.status, "verified"));

    const [pending] = await db
      .select({ total: count() })
      .from(evidencePacks)
      .where(eq(evidencePacks.status, "pending"));

    const latest = await db
      .select({ verifiedAt: evidencePacks.verifiedAt })
      .from(evidencePacks)
      .where(eq(evidencePacks.status, "verified"))
      .orderBy(desc(evidencePacks.verifiedAt))
      .limit(1);

    return {
      totalPacks: total.total,
      verifiedPacks: verified.total,
      pendingPacks: pending.total,
      latestVerifiedAt: latest[0]?.verifiedAt?.toISOString() ?? null,
    };
  } catch {
    return null;
  }
}
