import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { TableSkeleton } from "@/components/ui/loading";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/utils";
import { getRecommendations } from "@/server/data";
import { Bot, ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Agent Workflows — Nzila OS Control Plane",
  description: "AI agent recommendations requiring human review.",
};

const priorityOrder = { high: 0, medium: 1, low: 2 } as const;

async function AgentsContent() {
  const recommendations = await getRecommendations();

  if (recommendations.length === 0) {
    return (
      <EmptyState
        title="No pending recommendations"
        message="All agent recommendations have been reviewed."
      />
    );
  }

  const sorted = [...recommendations].sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  return (
    <div className="space-y-4">
      {sorted.map((rec) => (
        <div
          key={rec.id}
          className="rounded-lg border border-border bg-card p-6"
        >
          <div className="flex items-start gap-4">
            <Bot className="h-5 w-5 mt-0.5 flex-shrink-0 text-primary" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-foreground">
                  {rec.title}
                </h3>
                <StatusBadge
                  status={
                    rec.priority === "high"
                      ? "failed"
                      : rec.priority === "medium"
                        ? "degraded"
                        : "healthy"
                  }
                  label={rec.priority}
                />
                {rec.humanReviewRequired && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                    <ShieldAlert className="h-3 w-3" />
                    Human review required
                  </span>
                )}
              </div>

              <p className="text-sm text-muted-foreground mt-2">
                {rec.description}
              </p>

              <div className="grid gap-4 md:grid-cols-3 mt-4 text-xs">
                <div>
                  <span className="text-muted-foreground">Priority</span>
                  <p className="text-foreground mt-0.5 capitalize">{rec.priority}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Actionable</span>
                  <p className="text-foreground mt-0.5">
                    {rec.actionable ? "Yes" : "No"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Workflow</span>
                  <p className="font-mono text-foreground mt-0.5">{rec.workflowId}</p>
                </div>
              </div>

              {rec.suggestedAction && (
                <div className="mt-4 rounded-md bg-muted p-3">
                  <p className="text-xs font-medium text-foreground mb-1">
                    Suggested Action
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {rec.suggestedAction}
                  </p>
                </div>
              )}

              {rec.evidenceRefs && rec.evidenceRefs.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-foreground mb-1">
                    Evidence
                  </p>
                  <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                    {rec.evidenceRefs.map((ref, idx) => (
                      <li key={idx}>{ref}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-xs text-muted-foreground mt-3">
                Generated: {formatDateTime(rec.timestamp)}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AgentsPage() {
  return (
    <>
      <PageHeader
        title="Agent Workflows"
        description="AI-generated recommendations for human review. No autonomous mutation actions."
      />
      <Suspense fallback={<TableSkeleton rows={4} />}>
        <AgentsContent />
      </Suspense>
    </>
  );
}
