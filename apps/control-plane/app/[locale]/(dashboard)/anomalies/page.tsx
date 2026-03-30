import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { TableSkeleton } from "@/components/ui/loading";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AlertTriangle } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { getAnomalies } from "@/server/data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Anomalies — Nzila OS Control Plane",
  description: "Anomaly monitoring across all platform modules.",
};

const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 } as const;

async function AnomaliesContent() {
  const anomalies = await getAnomalies();

  if (anomalies.length === 0) {
    return (
      <EmptyState
        title="No anomalies detected"
        message="All platform metrics are within expected ranges."
      />
    );
  }

  const sorted = [...anomalies].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );

  return (
    <div className="space-y-4">
      {sorted.map((anomaly) => (
        <div
          key={anomaly.id}
          className="rounded-lg border border-border bg-card p-6"
        >
          <div className="flex items-start gap-4">
            <AlertTriangle
              className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
                anomaly.severity === "critical"
                  ? "text-red-600"
                  : anomaly.severity === "high"
                    ? "text-destructive"
                    : anomaly.severity === "medium"
                      ? "text-amber-500"
                      : "text-muted-foreground"
              }`}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-foreground">
                  {anomaly.anomalyType.replace(/_/g, " ")}
                </h3>
                <StatusBadge
                  status={
                    anomaly.severity === "critical" || anomaly.severity === "high"
                      ? "failed"
                      : anomaly.severity === "medium"
                        ? "degraded"
                        : "healthy"
                  }
                  label={anomaly.severity}
                />
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                  {anomaly.app}
                </span>
              </div>

              <p className="text-sm text-muted-foreground mt-2">
                {anomaly.description}
              </p>

              <div className="grid gap-4 md:grid-cols-4 mt-4 text-xs">
                <div>
                  <span className="text-muted-foreground">Metric</span>
                  <p className="font-mono text-foreground mt-0.5">
                    {anomaly.metric}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Expected</span>
                  <p className="text-foreground mt-0.5">
                    {anomaly.expectedValue}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Actual</span>
                  <p className="text-foreground mt-0.5">
                    {anomaly.actualValue}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Deviation</span>
                  <p className="text-foreground mt-0.5">
                    {anomaly.deviationFactor.toFixed(2)}×
                  </p>
                </div>
              </div>

              {anomaly.suggestedAction && (
                <div className="mt-4 rounded-md bg-muted p-3">
                  <p className="text-xs font-medium text-foreground mb-1">
                    Recommended Next Step
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {anomaly.suggestedAction}
                  </p>
                </div>
              )}

              <p className="text-xs text-muted-foreground mt-3">
                Detected: {formatDateTime(anomaly.timestamp)}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AnomaliesPage() {
  return (
    <>
      <PageHeader
        title="Anomalies"
        description="Operationally useful anomaly detection — not raw system noise."
      />
      <Suspense fallback={<TableSkeleton rows={4} />}>
        <AnomaliesContent />
      </Suspense>
    </>
  );
}
