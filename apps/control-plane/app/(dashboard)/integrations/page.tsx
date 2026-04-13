import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton } from "@/components/ui/loading";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Integration Fabric",
  description: "Manage external integrations, connections, deliveries, and identity links.",
};

async function IntegrationOverviewContent() {
  // Future: fetch from @/server/data when stores are wired
  const connections = { total: 0, active: 0, error: 0 };
  const runs = { total: 0, completed: 0, failed: 0 };
  const deadLetters = { total: 0, unresolved: 0 };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integration Fabric"
        description="External system connections, event subscriptions, and delivery monitoring."
      />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          title="Connections"
          total={connections.total}
          detail={`${connections.active} active · ${connections.error} errors`}
        />
        <SummaryCard
          title="Integration Runs"
          total={runs.total}
          detail={`${runs.completed} completed · ${runs.failed} failed`}
        />
        <SummaryCard
          title="Dead Letters"
          total={deadLetters.total}
          detail={`${deadLetters.unresolved} unresolved`}
        />
      </div>

      {/* Placeholder for tables */}
      <div className="rounded-md border p-6 text-center text-muted-foreground">
        <p>Connection list, recent runs, and delivery logs will appear here once data stores are connected.</p>
      </div>
    </div>
  );
}

function SummaryCard({ title, total, detail }: { title: string; total: number; detail: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-bold">{total}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <IntegrationOverviewContent />
    </Suspense>
  );
}
