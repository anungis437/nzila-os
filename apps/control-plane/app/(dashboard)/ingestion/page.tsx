import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton, TableSkeleton } from "@/components/ui/loading";
import { SummaryCard } from "@/components/ui/summary-card";
import { IngestionTable } from "@/components/deal-engine/ingestion-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Database, CheckCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { getIngestionRuns } from "@/server/deal-engine-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ingestion — Nzila OS Deal Engine",
  description: "Data ingestion runs for pilot accounts.",
};

async function IngestionContent() {
  const runs = await getIngestionRuns();

  if (runs.length === 0) {
    return <EmptyState title="No ingestion runs" message="Ingestion runs will appear when pilots receive data." />;
  }

  const completed = runs.filter((r) => r.status === "completed").length;
  const running = runs.filter((r) => r.status === "running").length;
  const failed = runs.filter((r) => r.status === "failed").length;
  const totalProcessed = runs.reduce((s, r) => s + r.processedCount, 0);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Total Runs"
          icon={<Database className="h-5 w-5" />}
          value={runs.length}
          subtitle={`${running} running`}
        />
        <SummaryCard
          title="Completed"
          icon={<CheckCircle className="h-5 w-5" />}
          value={completed}
          subtitle={`${Math.round((completed / runs.length) * 100)}% success rate`}
        />
        <SummaryCard
          title="Records Processed"
          icon={<RefreshCw className="h-5 w-5" />}
          value={totalProcessed.toLocaleString()}
          subtitle="across all runs"
        />
        <SummaryCard
          title="Failed Runs"
          icon={<AlertTriangle className="h-5 w-5" />}
          value={failed}
          subtitle={failed > 0 ? "requires attention" : "none"}
        />
      </div>

      <h2 className="text-lg font-semibold text-foreground mb-4 mt-8">Ingestion Runs</h2>
      <IngestionTable runs={runs} />
    </>
  );
}

export default function IngestionPage() {
  return (
    <>
      <PageHeader
        title="Ingestion"
        description="Data migration and ingestion runs for pilot accounts."
      />
      <Suspense fallback={<><CardSkeleton count={4} /><div className="mt-8"><TableSkeleton /></div></>}>
        <IngestionContent />
      </Suspense>
    </>
  );
}
