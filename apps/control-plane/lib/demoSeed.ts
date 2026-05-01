/**
 * Control Plane — Demo Seed Data
 *
 * Deterministic seed for all control plane pages.
 * Used by `pnpm -C apps/control-plane demo:seed`.
 */

import type { GovernanceStatus, GovernanceAuditTimelineEntry } from "@nzila/platform-governance/types";
import type { CrossAppInsight, OperationalSignal } from "@nzila/platform-intelligence/types";
import type { Anomaly } from "@nzila/platform-anomaly-engine/types";
import type { Recommendation } from "@nzila/platform-agent-workflows/types";
import type { ModuleStatus, ProcurementSummary } from "@/types";

// ── Fixed timestamp for determinism ─────────────────────

const NOW = "2026-03-11T10:00:00.000Z";

// ── Governance ──────────────────────────────────────────

export function seedGovernanceStatus(): GovernanceStatus {
  return {
    policy_engine: "healthy",
    evidence_pack: "verified",
    sbom_current: true,
    compliance_snapshot: "current",
    audit_timeline: "healthy",
    generated_at: NOW,
  };
}

export function seedGovernanceTimeline(): GovernanceAuditTimelineEntry[] {
  return [
    {
      timestamp: "2026-03-11T09:45:00.000Z",
      event_type: "compliance_check",
      actor: "ci-pipeline",
      policy_result: "pass",
      commit_hash: "a1b2c3d",
      source: "platform-governance",
    },
    {
      timestamp: "2026-03-11T08:30:00.000Z",
      event_type: "evidence_exported",
      actor: "evidence-collector",
      policy_result: "pass",
      commit_hash: "e4f5g6h",
      source: "platform-evidence-pack",
    },
    {
      timestamp: "2026-03-10T22:00:00.000Z",
      event_type: "policy_evaluated",
      actor: "policy-engine",
      policy_result: "pass",
      commit_hash: "i7j8k9l",
      source: "platform-policy-engine",
    },
    {
      timestamp: "2026-03-10T18:15:00.000Z",
      event_type: "approval_granted",
      actor: "admin@nzila.io",
      policy_result: "pass",
      commit_hash: "m0n1o2p",
      source: "platform-governance",
    },
  ];
}

// ── Intelligence ────────────────────────────────────────

export function seedInsights(): CrossAppInsight[] {
  return [
    {
      id: "11111111-1111-4111-8111-111111111111",
      timestamp: NOW,
      category: "usage",
      severity: "info",
      apps: ["union-eyes", "partners"],
      title: "Grievance filing rate increased 12% week-over-week",
      description:
        "Cross-referencing union-eyes grievance submissions with partner activity shows correlated uptick in dispute-adjacent filings.",
      dataPoints: { currentWeekFilings: 47, previousWeekFilings: 42 },
      recommendations: [
        "Review recent CBA changes for triggering clauses",
        "Confirm partner response SLAs are being met",
      ],
    },
    {
      id: "11111111-1111-4111-8111-111111111112",
      timestamp: "2026-03-10T14:00:00.000Z",
      category: "cost",
      severity: "warning",
      apps: ["cfo", "shop-quoter"],
      title: "Quote volume spike not reflected in revenue forecast",
      description:
        "Shop-quoter generated 34% more quotes this period but CFO revenue forecast unchanged — possible pipeline leakage.",
      dataPoints: { quotesGenerated: 218, forecastDelta: 0 },
      recommendations: [
        "Audit quote-to-order conversion funnel",
        "Sync shop-quoter pipeline data with CFO forecast model",
      ],
    },
    {
      id: "11111111-1111-4111-8111-111111111113",
      timestamp: "2026-03-09T10:00:00.000Z",
      category: "compliance",
      severity: "info",
      apps: ["console"],
      title: "All governance controls passing for 7 consecutive days",
      description:
        "Compliance snapshot chain shows sustained green state across all control families.",
      dataPoints: { consecutiveDays: 7, totalControls: 42 },
      recommendations: [],
    },
  ];
}

export function seedSignals(): OperationalSignal[] {
  return [
    {
      id: "22222222-2222-4222-8222-222222222221",
      timestamp: NOW,
      signalType: "spike",
      app: "union-eyes",
      metric: "grievance_submissions",
      currentValue: 47,
      baselineValue: 38,
      deviationPercent: 23.7,
      confidence: 0.89,
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      timestamp: "2026-03-10T12:00:00.000Z",
      signalType: "trend_change",
      app: "shop-quoter",
      metric: "quotes_generated",
      currentValue: 218,
      baselineValue: 163,
      deviationPercent: 33.7,
      confidence: 0.92,
    },
  ];
}

// ── Anomalies ───────────────────────────────────────────

export function seedAnomalies(): Anomaly[] {
  return [
    {
      id: "33333333-3333-4333-8333-333333333331",
      timestamp: NOW,
      anomalyType: "grievance_spike",
      severity: "medium",
      app: "union-eyes",
      metric: "grievance_submissions_daily",
      expectedValue: 6,
      actualValue: 14,
      deviationFactor: 2.33,
      description:
        "Daily grievance submissions exceeded 2× baseline for 3 consecutive days across local 412.",
      suggestedAction:
        "Review local 412 CBA amendments and confirm representative availability.",
    },
    {
      id: "33333333-3333-4333-8333-333333333332",
      timestamp: "2026-03-10T16:00:00.000Z",
      anomalyType: "pricing_outlier",
      severity: "high",
      app: "shop-quoter",
      metric: "quote_unit_price",
      expectedValue: 42.5,
      actualValue: 12.8,
      deviationFactor: 0.3,
      description:
        "Quote #QT-2026-0451 priced at 70% below category baseline — possible data entry error or unauthorized discount.",
      suggestedAction:
        "Flag quote for manager review before order conversion.",
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      timestamp: "2026-03-09T08:00:00.000Z",
      anomalyType: "partner_performance_drop",
      severity: "low",
      app: "partners",
      metric: "partner_response_time_hours",
      expectedValue: 24,
      actualValue: 72,
      deviationFactor: 3.0,
      description:
        "Partner 'Acme Supplies' average response time tripled — SLA breach risk.",
      suggestedAction:
        "Escalate to partner account manager and review contract penalties.",
    },
  ];
}

// ── Agent Recommendations ───────────────────────────────

export function seedRecommendations(): Recommendation[] {
  return [
    {
      id: "44444444-4444-4444-8444-444444444441",
      workflowId: "wf-grievance-triage",
      timestamp: NOW,
      title: "Increase representative allocation for local 412",
      description:
        "Grievance spike in local 412 correlates with recent CBA amendment. Recommend adding 2 additional representatives to handle increased filing volume.",
      priority: "high",
      actionable: true,
      suggestedAction:
        "Notify HR to assign additional representatives to local 412.",
      evidenceRefs: ["33333333-3333-4333-8333-333333333331", "11111111-1111-4111-8111-111111111111"],
      humanReviewRequired: true,
    },
    {
      id: "44444444-4444-4444-8444-444444444442",
      workflowId: "wf-pricing-review",
      timestamp: "2026-03-10T16:30:00.000Z",
      title: "Quarantine anomalous quote QT-2026-0451",
      description:
        "Quote priced 70% below baseline. Agent recommends holding conversion pending manager approval.",
      priority: "high",
      actionable: true,
      suggestedAction:
        "Place quote in review queue and notify pricing manager.",
      evidenceRefs: ["33333333-3333-4333-8333-333333333332"],
      humanReviewRequired: true,
    },
    {
      id: "44444444-4444-4444-8444-444444444443",
      workflowId: "wf-partner-sla",
      timestamp: "2026-03-09T09:00:00.000Z",
      title: "Send SLA warning to Acme Supplies",
      description:
        "Partner response time 3× above threshold. Recommend automated SLA warning before formal breach notice.",
      priority: "medium",
      actionable: true,
      suggestedAction:
        "Trigger SLA warning email via partner portal.",
      evidenceRefs: ["33333333-3333-4333-8333-333333333333"],
      humanReviewRequired: false,
    },
  ];
}

// ── Modules ─────────────────────────────────────────────

export function seedModules(): ModuleStatus[] {
  return [
    {
      id: "union-eyes",
      name: "UnionEyes",
      description: "Union case management, grievances, elections, bargaining",
      health: "healthy",
      version: "1.0.0",
      orgAvailability: ["*"],
      hasEvidenceExport: true,
      hasGovernanceIntegration: true,
      hasTelemetryIntegration: true,
      lastActivity: NOW,
      lastActivitySummary: "47 grievances filed this week",
    },
    {
      id: "shop-quoter",
      name: "Shop Quoter",
      description: "Product quoting and pricing engine",
      health: "healthy",
      version: "1.0.0",
      orgAvailability: ["*"],
      hasEvidenceExport: true,
      hasGovernanceIntegration: true,
      hasTelemetryIntegration: true,
      lastActivity: NOW,
      lastActivitySummary: "218 quotes generated this period",
    },
    {
      id: "cfo",
      name: "CFO",
      description: "Financial oversight, budgets, reconciliation",
      health: "healthy",
      version: "1.0.0",
      orgAvailability: ["*"],
      hasEvidenceExport: true,
      hasGovernanceIntegration: true,
      hasTelemetryIntegration: true,
      lastActivity: "2026-03-11T08:00:00.000Z",
      lastActivitySummary: "Q1 budget 64% consumed",
    },
    {
      id: "partners",
      name: "Partners",
      description: "Partner portal with entitlement-gated access",
      health: "degraded",
      version: "1.0.0",
      orgAvailability: ["*"],
      hasEvidenceExport: true,
      hasGovernanceIntegration: true,
      hasTelemetryIntegration: true,
      lastActivity: "2026-03-10T14:00:00.000Z",
      lastActivitySummary: "1 partner SLA warning pending",
    },
    {
      id: "web",
      name: "Web",
      description: "Public marketing and landing pages",
      health: "healthy",
      version: "1.0.0",
      orgAvailability: ["*"],
      hasEvidenceExport: false,
      hasGovernanceIntegration: false,
      hasTelemetryIntegration: true,
      lastActivity: "2026-03-11T09:00:00.000Z",
      lastActivitySummary: "1.2k page views today",
    },
    {
      id: "console",
      name: "Console",
      description: "Internal ops console for governance, finance, ML, AI",
      health: "healthy",
      version: "1.0.0",
      orgAvailability: ["internal"],
      hasEvidenceExport: true,
      hasGovernanceIntegration: true,
      hasTelemetryIntegration: true,
      lastActivity: NOW,
      lastActivitySummary: "Governance check passed",
    },
  ];
}

// ── Procurement ─────────────────────────────────────────

export function seedProcurement(): ProcurementSummary {
  return {
    packId: "pack-2026-03-11-001",
    manifestHash:
      "sha256:a3f8c9e2d1b4a5f6e7c8d9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0",
    signatureStatus: "verified",
    sbomRef: "sbom-2026-03-11-main.json",
    attestationStatus: "valid",
    createdAt: NOW,
  };
}

// ── Main seed runner ────────────────────────────────────

export async function seedDemo() {
  const governance = seedGovernanceStatus();
  const timeline = seedGovernanceTimeline();
  const insights = seedInsights();
  const signals = seedSignals();
  const anomalies = seedAnomalies();
  const recommendations = seedRecommendations();
  const modules = seedModules();
  const procurement = seedProcurement();

  /* eslint-disable no-console */
  console.log("[demo:seed] Control Plane demo data created");
  console.log(`  Governance: ${governance.policy_engine}`);
  console.log(`  Timeline entries: ${timeline.length}`);
  console.log(`  Insights: ${insights.length}`);
  console.log(`  Signals: ${signals.length}`);
  console.log(`  Anomalies: ${anomalies.length}`);
  console.log(`  Recommendations: ${recommendations.length}`);
  console.log(`  Modules: ${modules.length}`);
  console.log(`  Procurement pack: ${procurement.packId}`);
  /* eslint-enable no-console */

  return {
    governance,
    timeline,
    insights,
    signals,
    anomalies,
    recommendations,
    modules,
    procurement,
  };
}

if (process.argv[1]?.includes("demoSeed")) {
  seedDemo().catch((err) => {
    /* eslint-disable no-console */
    console.error(err);
    /* eslint-enable no-console */
    process.exit(1);
  });
}
