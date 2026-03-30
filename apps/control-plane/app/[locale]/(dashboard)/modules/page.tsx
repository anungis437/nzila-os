import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton } from "@/components/ui/loading";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getModules } from "@/server/data";
import type { ModuleHealth } from "@/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Modules — Nzila OS Control Plane",
  description: "Platform module status and health overview.",
};

function healthToStatus(health: ModuleHealth) {
  switch (health) {
    case "healthy":
      return "healthy" as const;
    case "degraded":
      return "degraded" as const;
    case "offline":
      return "failed" as const;
    default:
      return "unknown" as const;
  }
}

async function ModulesContent() {
  const modules = await getModules();

  if (modules.length === 0) {
    return (
      <EmptyState
        title="No modules registered"
        message="Platform modules will appear here once registered."
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {modules.map((mod) => (
        <div
          key={mod.id}
          className="rounded-lg border border-border bg-card p-6"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">
              {mod.name}
            </h3>
            <StatusBadge
              status={healthToStatus(mod.health)}
              label={mod.health}
            />
          </div>

          <p className="text-xs text-muted-foreground mb-4">
            {mod.description}
          </p>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground">Version</span>
              <p className="font-mono text-foreground mt-0.5">
                {mod.version}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Last Activity</span>
              <p className="text-foreground mt-0.5">
                {mod.lastActivitySummary}
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border">
            <p className="text-xs font-medium text-foreground mb-2">
              Integrations
            </p>
            <div className="flex flex-wrap gap-2">
              {mod.hasGovernanceIntegration && (
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                  Governance
                </span>
              )}
              {mod.hasEvidenceExport && (
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                  Evidence
                </span>
              )}
              {mod.hasTelemetryIntegration && (
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                  Telemetry
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ModulesPage() {
  return (
    <>
      <PageHeader
        title="Modules"
        description="Status and health of every registered platform module."
      />
      <Suspense fallback={<CardSkeleton count={6} />}>
        <ModulesContent />
      </Suspense>
    </>
  );
}
