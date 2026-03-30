import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton, TableSkeleton } from "@/components/ui/loading";
import { StatusBadge } from "@/components/ui/status-badge";
import { Brain, Zap, AlertCircle as _AlertCircle } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { getInsights, getSignals } from "@/server/data";
import { IntelligenceQueryBox } from "@/components/intelligence/query-box";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Intelligence — Nzila OS Control Plane",
  description: "Cross-app insights, operational signals, and evidence-backed intelligence queries.",
};

async function IntelligenceContent() {
  const [insights, signals] = await Promise.all([
    getInsights(),
    getSignals(),
  ]);

  return (
    <>
      {/* Query box */}
      <IntelligenceQueryBox />

      {/* Recent insights */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Brain className="h-5 w-5" />
          Recent Insights
        </h2>
        {insights.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No insights available.
          </p>
        ) : (
          <div className="space-y-4">
            {insights.map((insight) => (
              <div
                key={insight.id}
                className="rounded-lg border border-border bg-card p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-foreground">
                        {insight.title}
                      </h3>
                      <StatusBadge
                        status={
                          insight.severity === "critical"
                            ? "failed"
                            : insight.severity === "warning"
                              ? "degraded"
                              : "healthy"
                        }
                        label={insight.severity}
                      />
                      <span className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-muted">
                        {insight.category}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {insight.description}
                    </p>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <span className="text-xs text-muted-foreground">Apps:</span>
                      {insight.apps.map((app) => (
                        <span
                          key={app}
                          className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded"
                        >
                          {app}
                        </span>
                      ))}
                      <span className="text-xs text-muted-foreground ml-2">
                        {formatDateTime(insight.timestamp)}
                      </span>
                    </div>
                    {insight.recommendations.length > 0 && (
                      <div className="mt-3 border-t border-border pt-3">
                        <p className="text-xs font-medium text-foreground mb-1">
                          Recommendations
                        </p>
                        <ul className="list-disc list-inside space-y-1">
                          {insight.recommendations.map((rec, i) => (
                            <li key={i} className="text-xs text-muted-foreground">
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Operational signals */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Operational Signals
        </h2>
        {signals.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No active signals.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 px-4 text-left font-medium text-muted-foreground">
                    Type
                  </th>
                  <th className="py-3 px-4 text-left font-medium text-muted-foreground">
                    App
                  </th>
                  <th className="py-3 px-4 text-left font-medium text-muted-foreground">
                    Metric
                  </th>
                  <th className="py-3 px-4 text-right font-medium text-muted-foreground">
                    Deviation
                  </th>
                  <th className="py-3 px-4 text-right font-medium text-muted-foreground">
                    Confidence
                  </th>
                  <th className="py-3 px-4 text-left font-medium text-muted-foreground">
                    When
                  </th>
                </tr>
              </thead>
              <tbody>
                {signals.map((signal) => (
                  <tr key={signal.id} className="border-b border-border">
                    <td className="py-3 px-4">
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                        {signal.signalType.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-foreground">{signal.app}</td>
                    <td className="py-3 px-4 text-foreground font-mono text-xs">
                      {signal.metric}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={
                          signal.deviationPercent > 20
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-foreground"
                        }
                      >
                        {signal.deviationPercent > 0 ? "+" : ""}
                        {signal.deviationPercent.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-foreground">
                      {(signal.confidence * 100).toFixed(0)}%
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">
                      {formatDateTime(signal.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export default function IntelligencePage() {
  return (
    <>
      <PageHeader
        title="Intelligence"
        description="Cross-app insights and evidence-backed intelligence — demonstrating platform-wide understanding."
      />
      <Suspense
        fallback={
          <>
            <CardSkeleton count={1} />
            <div className="mt-8">
              <TableSkeleton rows={3} />
            </div>
          </>
        }
      >
        <IntelligenceContent />
      </Suspense>
    </>
  );
}
