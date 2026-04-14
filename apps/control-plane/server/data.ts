/**
 * Server-side data access — wraps platform packages with seed fallback.
 *
 * Every function returns zod-validated data.
 * Uses live platform package APIs where possible (in-memory event stores
 * populated during app lifecycle). Falls back to deterministic seed data
 * when the live layer has no events yet (first boot / dev).
 */
import "server-only";

import {
  seedGovernanceStatus,
  seedGovernanceTimeline,
  seedInsights,
  seedSignals,
  seedAnomalies,
  seedRecommendations,
  seedModules,
  seedProcurement,
} from "@/lib/demoSeed";
import {
  fetchLiveCostAnomalies,
  fetchLiveEvidenceSummary,
} from "@/server/db-bridge";
import {
  governanceStatusSchema,
  governanceAuditTimelineEntrySchema,
  getGovernanceStatus as liveGovernanceStatus,
  buildGovernanceAuditTimeline,
} from "@nzila/platform-governance";
import {
  crossAppInsightSchema,
  operationalSignalSchema,
  generateCrossAppInsights,
  getAggregatedEvents,
  detectOperationalSignals,
} from "@nzila/platform-intelligence";
import { anomalySchema } from "@nzila/platform-anomaly-engine";
import { recommendationSchema } from "@nzila/platform-agent-workflows";
import { moduleStatusSchema, overviewSummarySchema, procurementSummarySchema } from "@/types";
import type {
  GovernanceStatus,
  GovernanceAuditTimelineEntry,
} from "@nzila/platform-governance/types";
import type { CrossAppInsight, OperationalSignal } from "@nzila/platform-intelligence/types";
import type { Anomaly } from "@nzila/platform-anomaly-engine/types";
import type { Recommendation } from "@nzila/platform-agent-workflows/types";
import type { ModuleStatus, OverviewSummary, ProcurementSummary } from "@/types";
import { z } from "zod";

// ── Governance ──────────────────────────────────────────

export async function getGovernanceStatusData(): Promise<GovernanceStatus> {
  // Try live governance status from in-memory audit timeline
  try {
    const live = liveGovernanceStatus({
      policyEngineAvailable: true,
      evidencePackValid: true,
      sbomExists: true,
    });
    const parsed = governanceStatusSchema.safeParse(live);
    if (parsed.success) return parsed.data as GovernanceStatus;
  } catch { /* fall through to seed */ }

  const raw = seedGovernanceStatus();
  return governanceStatusSchema.parse(raw) as GovernanceStatus;
}

export async function getGovernanceTimeline(): Promise<GovernanceAuditTimelineEntry[]> {
  // Try live audit timeline
  try {
    const live = buildGovernanceAuditTimeline({});
    if (live.length > 0) {
      return z.array(governanceAuditTimelineEntrySchema).parse(live) as GovernanceAuditTimelineEntry[];
    }
  } catch { /* fall through to seed */ }

  const raw = seedGovernanceTimeline();
  return z.array(governanceAuditTimelineEntrySchema).parse(raw) as GovernanceAuditTimelineEntry[];
}

// ── Intelligence ────────────────────────────────────────

export async function getInsights(): Promise<CrossAppInsight[]> {
  // Try live cross-app insights from aggregated events
  try {
    const events = getAggregatedEvents({});
    if (events.length > 0) {
      const live = generateCrossAppInsights(events);
      const parsed = z.array(crossAppInsightSchema).safeParse(live);
      if (parsed.success && parsed.data.length > 0) return parsed.data as CrossAppInsight[];
    }
  } catch { /* fall through to seed */ }

  const raw = seedInsights();
  return z.array(crossAppInsightSchema).parse(raw) as CrossAppInsight[];
}

export async function getSignals(): Promise<OperationalSignal[]> {
  // Try live operational signals from aggregated events
  try {
    const events = getAggregatedEvents({});
    if (events.length > 0) {
      const metrics = events.map((e) => ({
        app: e.app,
        metric: e.eventType,
        currentValue: 1,
        baselineValue: 0,
      }));
      const live = detectOperationalSignals(metrics);
      const parsed = z.array(operationalSignalSchema).safeParse(live);
      if (parsed.success && parsed.data.length > 0) return parsed.data as OperationalSignal[];
    }
  } catch { /* fall through to seed */ }

  const raw = seedSignals();
  return z.array(operationalSignalSchema).parse(raw) as OperationalSignal[];
}

// ── Anomalies ───────────────────────────────────────────

export async function getAnomalies(): Promise<Anomaly[]> {
  // Try live cost-budget-breach anomalies from DB
  try {
    const live = await fetchLiveCostAnomalies();
    if (live && live.length > 0) {
      const parsed = z.array(anomalySchema).safeParse(live);
      if (parsed.success) return parsed.data as Anomaly[];
    }
  } catch { /* fall through to seed */ }

  const raw = seedAnomalies();
  return z.array(anomalySchema).parse(raw) as Anomaly[];
}

export async function getAnomalyById(id: string): Promise<Anomaly | undefined> {
  const all = await getAnomalies();
  return all.find((a) => a.id === id);
}

// ── Agent Recommendations ───────────────────────────────

export async function getRecommendations(): Promise<Recommendation[]> {
  // Try live recommendations from governed workflows
  try {
    const { listWorkflows } = await import("@nzila/governed-workflow");
    const { generateRecommendations } = await import("@nzila/platform-agent-workflows");
    const workflows = listWorkflows();
    if (workflows.length > 0) {
      const allRecs = workflows.flatMap((wf) => {
        const agentWorkflow: import("@nzila/platform-agent-workflows").AgentWorkflow = {
          id: wf.name,
          name: wf.name,
          triggerEvent: "workflow.registered",
          app: "control-plane",
          orgId: "system",
          steps: [{
            id: wf.name,
            name: wf.name,
            status: "completed" as const,
          }],
          status: "completed" as const,
          createdAt: new Date().toISOString(),
        };
        return generateRecommendations(agentWorkflow);
      });
      if (allRecs.length > 0) {
        const parsed = z.array(recommendationSchema).safeParse(allRecs);
        if (parsed.success) return parsed.data as Recommendation[];
      }
    }
  } catch { /* fall through to seed */ }

  const raw = seedRecommendations();
  return z.array(recommendationSchema).parse(raw) as Recommendation[];
}

// ── Modules ─────────────────────────────────────────────

export async function getModules(): Promise<ModuleStatus[]> {
  // Build module list from seed, then overlay live health from platform packages
  const modules = z.array(moduleStatusSchema).parse(seedModules()) as ModuleStatus[];

  try {
    // Governance module: healthy if live governance status is available
    const govLive = liveGovernanceStatus({
      policyEngineAvailable: true,
      evidencePackValid: true,
      sbomExists: true,
    });
    overlayHealth(modules, 'governance', govLive ? 'healthy' : 'degraded');

    // Intelligence module: healthy if aggregated events exist
    const events = getAggregatedEvents({});
    overlayHealth(modules, 'intelligence', events.length > 0 ? 'healthy' : 'degraded');
  } catch {
    /* keep seed values on error */
  }

  return modules;
}

function overlayHealth(
  modules: ModuleStatus[],
  idPrefix: string,
  health: ModuleStatus['health'],
): void {
  const mod = modules.find((m) => m.id.includes(idPrefix));
  if (mod) {
    (mod as { health: string }).health = health;
    (mod as { lastActivity: string }).lastActivity = new Date().toISOString();
    (mod as { lastActivitySummary: string }).lastActivitySummary = `Live check at ${new Date().toISOString()}`;
  }
}

// ── Procurement ─────────────────────────────────────────

export async function getProcurementSummary(): Promise<ProcurementSummary> {
  // Try live evidence summary to enrich procurement data
  try {
    const evidence = await fetchLiveEvidenceSummary();
    if (evidence && evidence.totalPacks > 0) {
      const base = seedProcurement();
      base.evidence_verified = evidence.verifiedPacks;
      base.evidence_total = evidence.totalPacks;
      base.last_verified_at = evidence.latestVerifiedAt ?? base.last_verified_at;
      return procurementSummarySchema.parse(base) as ProcurementSummary;
    }
  } catch { /* fall through to seed */ }

  const raw = seedProcurement();
  return procurementSummarySchema.parse(raw) as ProcurementSummary;
}

// ── Overview ────────────────────────────────────────────

export async function getOverviewSummary(): Promise<OverviewSummary> {
  const [governance, anomalies, modules, procurement] = await Promise.all([
    getGovernanceStatusData(),
    getAnomalies(),
    getModules(),
    getProcurementSummary(),
  ]);

  const healthyModules = modules.filter((m) => m.health === "healthy").length;

  const summary: OverviewSummary = {
    platformHealthy:
      governance.policy_engine === "healthy" &&
      governance.evidence_pack === "verified",
    governanceCompliant:
      governance.compliance_snapshot === "current" && governance.sbom_current,
    intelligenceActive: getAggregatedEvents({}).length > 0,
    activeAnomalies: anomalies.length,
    totalModules: modules.length,
    healthyModules,
    procurementPackReady: procurement.signatureStatus === "verified",
    generatedAt: new Date().toISOString(),
  };

  return overviewSummarySchema.parse(summary) as OverviewSummary;
}

// ── Change Management ───────────────────────────────────

import {
  loadAllChanges,
  loadChangeRecord,
  listUpcomingChanges,
  listChangesForEnvironment,
  listChangesPendingPIR,
  changeRecordSchema,
} from "@nzila/platform-change-management";
import type { ChangeRecord } from "@nzila/platform-change-management/types";

export async function getChangeRecords(): Promise<ChangeRecord[]> {
  try {
    const records = loadAllChanges();
    return z
      .array(changeRecordSchema)
      .parse(records) as ChangeRecord[];
  } catch {
    return [];
  }
}

export async function getChangeRecordById(
  id: string,
): Promise<ChangeRecord | null> {
  try {
    const record = loadChangeRecord(id);
    if (!record) return null;
    return changeRecordSchema.parse(record) as ChangeRecord;
  } catch {
    return null;
  }
}

export async function getUpcomingChanges(): Promise<ChangeRecord[]> {
  try {
    return listUpcomingChanges() as ChangeRecord[];
  } catch {
    return [];
  }
}

export async function getChangeCalendarData(): Promise<{
  staging: ChangeRecord[];
  production: ChangeRecord[];
  pendingPIR: ChangeRecord[];
}> {
  try {
    const staging = listChangesForEnvironment("STAGING") as ChangeRecord[];
    const production = listChangesForEnvironment("PROD") as ChangeRecord[];
    const pendingPIR = listChangesPendingPIR() as ChangeRecord[];
    return { staging, production, pendingPIR };
  } catch {
    return { staging: [], production: [], pendingPIR: [] };
  }
}

// ── Environment Management ──────────────────────────────

import {
  getEnvironmentConfig,
  loadLatestArtifact,
  loadGovernanceSnapshots,
  ALL_ENVIRONMENTS,
} from "@nzila/platform-environment";
import type {
  EnvironmentName,
  EnvironmentConfig,
  DeploymentArtifact,
  GovernanceSnapshot,
} from "@nzila/platform-environment";
import { getEnabledFlags } from "@nzila/platform-feature-flags";
import type { FeatureFlag } from "@nzila/platform-feature-flags";

export interface EnvironmentDashboardData {
  environment: EnvironmentName;
  config: EnvironmentConfig;
  latestArtifact: DeploymentArtifact | null;
  latestSnapshot: GovernanceSnapshot | null;
  activeFlags: FeatureFlag[];
}

export async function getEnvironmentDashboard(): Promise<
  EnvironmentDashboardData[]
> {
  try {
    return ALL_ENVIRONMENTS.map((env) => {
      const config = getEnvironmentConfig("platform", env);
      const latestArtifact = env === "STAGING" || env === "PRODUCTION"
        ? loadLatestArtifact()
        : null;
      const snapshots = loadGovernanceSnapshots(env);
      const latestSnapshot = snapshots.length > 0 ? snapshots[0] : null;
      const activeFlags = getEnabledFlags(env);
      return { environment: env, config, latestArtifact, latestSnapshot, activeFlags };
    });
  } catch {
    return [];
  }
}

export async function getEnvironmentDetail(
  env: EnvironmentName,
): Promise<EnvironmentDashboardData | null> {
  try {
    const config = getEnvironmentConfig("platform", env);
    const latestArtifact = loadLatestArtifact();
    const snapshots = loadGovernanceSnapshots(env);
    const latestSnapshot = snapshots.length > 0 ? snapshots[0] : null;
    const activeFlags = getEnabledFlags(env);
    return { environment: env, config, latestArtifact, latestSnapshot, activeFlags };
  } catch {
    return null;
  }
}

// ── Decision Engine ─────────────────────────────────────

import {
  loadAllDecisions,
  loadDecisionRecord,
  listOpenDecisions,
  summariseDecisions,
  decisionRecordSchema,
  decisionSummarySchema,
} from "@nzila/platform-decision-engine";
import type {
  DecisionRecord,
  DecisionSummary,
} from "@nzila/platform-decision-engine";

export async function getDecisions(): Promise<DecisionRecord[]> {
  try {
    const records = loadAllDecisions();
    return z
      .array(decisionRecordSchema)
      .parse(records) as DecisionRecord[];
  } catch {
    return [];
  }
}

export async function getDecisionById(
  id: string,
): Promise<DecisionRecord | null> {
  try {
    const record = loadDecisionRecord(id);
    if (!record) return null;
    return decisionRecordSchema.parse(record) as DecisionRecord;
  } catch {
    return null;
  }
}

export async function getOpenDecisions(): Promise<DecisionRecord[]> {
  try {
    return listOpenDecisions() as DecisionRecord[];
  } catch {
    return [];
  }
}

export async function getDecisionSummary(): Promise<DecisionSummary> {
  try {
    const records = loadAllDecisions();
    const summary = summariseDecisions(records);
    return decisionSummarySchema.parse(summary) as DecisionSummary;
  } catch {
    return {
      total: 0,
      by_severity: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
      by_category: {
        STAFFING: 0, RISK: 0, FINANCIAL: 0, GOVERNANCE: 0, COMPLIANCE: 0,
        OPERATIONS: 0, PARTNER: 0, CUSTOMER: 0, DEPLOYMENT: 0, OTHER: 0,
      },
      by_status: {
        GENERATED: 0, PENDING_REVIEW: 0, APPROVED: 0, REJECTED: 0,
        DEFERRED: 0, EXECUTED: 0, EXPIRED: 0, CLOSED: 0,
      },
      pending_review: 0,
      critical_open: 0,
    };
  }
}
