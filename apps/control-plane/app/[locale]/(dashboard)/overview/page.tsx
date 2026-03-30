import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton } from "@/components/ui/loading";
import { PlatformHealthCard } from "@/components/overview/platform-health-card";
import { GovernanceSummaryCard } from "@/components/overview/governance-summary-card";
import { IntelligenceSummaryCard } from "@/components/overview/intelligence-summary-card";
import { ModuleStatusCard } from "@/components/overview/module-status-card";
import { ProcurementSummaryCard } from "@/components/overview/procurement-summary-card";
import { SummaryCard } from "@/components/ui/summary-card";
import { AlertTriangle } from "lucide-react";
import {
  getOverviewSummary,
  getGovernanceStatusData,
  getInsights,
  getSignals,
  getModules,
  getAnomalies,
  getProcurementSummary,
} from "@/server/data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Overview — Nzila OS Control Plane",
  description: "Platform health, governance, intelligence, and module status at a glance.",
};

async function OverviewContent() {
  const [overview, governance, insights, signals, modules, anomalies, procurement] =
    await Promise.all([
      getOverviewSummary(),
      getGovernanceStatusData(),
      getInsights(),
      getSignals(),
      getModules(),
      getAnomalies(),
      getProcurementSummary(),
    ]);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <PlatformHealthCard
          platformHealthy={overview.platformHealthy}
          healthyModules={overview.healthyModules}
          totalModules={overview.totalModules}
        />
        <GovernanceSummaryCard status={governance} />
        <IntelligenceSummaryCard
          insightCount={insights.length}
          signalCount={signals.length}
        />
        <SummaryCard
          title="Active Anomalies"
          icon={<AlertTriangle className="h-5 w-5" />}
          value={anomalies.length}
          subtitle={`${anomalies.filter((a) => a.severity === "high" || a.severity === "critical").length} high/critical severity`}
        />
        <ModuleStatusCard modules={modules} />
        <ProcurementSummaryCard procurement={procurement} />
      </div>

      {/* Recent anomalies preview */}
      {anomalies.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Recent Anomalies
          </h2>
          <div className="space-y-3">
            {anomalies.slice(0, 3).map((anomaly) => (
              <div
                key={anomaly.id}
                className="rounded-lg border border-border bg-card p-4 flex items-start gap-4"
              >
                <AlertTriangle
                  className={`h-5 w-5 mt-0.5 ${
                    anomaly.severity === "critical" || anomaly.severity === "high"
                      ? "text-destructive"
                      : anomaly.severity === "medium"
                        ? "text-amber-500"
                        : "text-muted-foreground"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {anomaly.anomalyType.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {anomaly.app}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {anomaly.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default function OverviewPage() {
  return (
    <>
      <PageHeader
        title="Control Plane Overview"
        description="Is the platform healthy, governed, and producing useful intelligence?"
      />
      <Suspense fallback={<CardSkeleton count={6} />}>
        <OverviewContent />
      </Suspense>
    </>
  );
}
