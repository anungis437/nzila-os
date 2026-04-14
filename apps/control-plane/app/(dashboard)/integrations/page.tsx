import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton } from "@/components/ui/loading";
import { StatusBadge } from "@/components/ui/status-badge";
import { Cable, Play, AlertTriangle, Plug } from "lucide-react";
import { SummaryCard } from "@/components/ui/summary-card";
import {
  getIntegrationSummary,
  getRegisteredConnectors,
} from "@/server/integration-data";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Integration Fabric — Nzila OS Control Plane",
  description: "Manage external integrations, connections, deliveries, and identity links.",
};

async function IntegrationOverviewContent() {
  const [summary, connectors] = await Promise.all([
    getIntegrationSummary(),
    getRegisteredConnectors(),
  ]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Connections"
          icon={<Cable className="h-5 w-5" />}
          value={summary.connections.total}
          subtitle={`${summary.connections.active} active · ${summary.connections.error} errors`}
        />
        <SummaryCard
          title="Integration Runs"
          icon={<Play className="h-5 w-5" />}
          value={summary.runs.total}
          subtitle={`${summary.runs.completed} completed · ${summary.runs.failed} failed`}
        />
        <SummaryCard
          title="Dead Letters"
          icon={<AlertTriangle className="h-5 w-5" />}
          value={summary.deadLetters.total}
          subtitle={`${summary.deadLetters.unresolved} unresolved`}
        />
        <SummaryCard
          title="Registered Connectors"
          icon={<Plug className="h-5 w-5" />}
          value={summary.registeredConnectors}
          subtitle={`${connectors.length} connector types`}
        />
      </div>

      {summary.state !== "ok" ? (
        <div className="rounded-md border p-4 text-sm text-muted-foreground">
          {summary.state === "no_data"
            ? "NO DATA: No integration records found in integration_connections, integration_runs, integration_delivery_attempts, or integration_dead_letters."
            : `DATA ERROR: ${summary.errorMessage ?? "Unable to read integration tables."}`}
        </div>
      ) : null}

      {/* Connector table */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Connector Registry
        </h2>
        <div className="rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Version</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Capabilities</th>
              </tr>
            </thead>
            <tbody>
              {connectors.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-muted-foreground" colSpan={4}>
                    NO DATA: No connector records in integration_connections.
                  </td>
                </tr>
              ) : connectors.map((c) => (
                <tr key={c.type} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status="healthy" label={c.type} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.version}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.capabilities.map((cap) => (
                        <span
                          key={cap}
                          className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <>
      <PageHeader
        title="Integration Fabric"
        description="External system connections, event subscriptions, and delivery monitoring."
      />
      <Suspense fallback={<CardSkeleton count={4} />}>
        <IntegrationOverviewContent />
      </Suspense>
    </>
  );
}
