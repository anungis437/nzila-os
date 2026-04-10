import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton, TableSkeleton } from "@/components/ui/loading";
import { SummaryCard } from "@/components/ui/summary-card";
import { PipelineTable } from "@/components/deal-engine/pipeline-table";
import { StageDistribution } from "@/components/deal-engine/stage-distribution";
import { TrendingUp, AlertTriangle, DollarSign, Clock, Target } from "lucide-react";
import { getDeals, getPipelineSummary, getPipelineIntelligence, getSystemHealth } from "@/server/deal-engine-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pipeline — Nzila OS Deal Engine",
  description: "Deal pipeline across all products and sources.",
};

async function PipelineContent() {
  const [deals, health] = await Promise.all([
    getDeals(),
    getSystemHealth(),
  ]);
  const [summary, intel] = await Promise.all([
    getPipelineSummary(deals),
    getPipelineIntelligence(deals),
  ]);

  return (
    <>
      {health.overall === "degraded" && (
        <div className="mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
          <p className="text-sm font-medium text-red-800 dark:text-red-300">
            System operating in degraded mode — some adapters are using fallback data:{" "}
            {health.adapters.filter((a) => a.status === "degraded").map((a) => a.adapter).join(", ")}
          </p>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <SummaryCard
          title="Total Deals"
          icon={<TrendingUp className="h-5 w-5" />}
          value={summary.totalDeals}
          subtitle={`${deals.filter((d) => d.stage !== "dormant" && d.stage !== "lost").length} active`}
        />
        <SummaryCard
          title="Pipeline Value"
          icon={<DollarSign className="h-5 w-5" />}
          value={`$${summary.totalValue.toLocaleString()}`}
          subtitle="CAD estimated"
        />
        <SummaryCard
          title="Stalled Deals"
          icon={<AlertTriangle className="h-5 w-5" />}
          value={intel.stalledDeals.length}
          subtitle=">14 days in stage"
        />
        <SummaryCard
          title="Avg. Days in Stage"
          icon={<Clock className="h-5 w-5" />}
          value={summary.averageDaysInStage}
          subtitle="across all active"
        />
        <SummaryCard
          title="Conversion Ready"
          icon={<Target className="h-5 w-5" />}
          value={intel.conversionReady.length}
          subtitle="in pilot review"
        />
      </div>

      {intel.stalledDeals.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
          <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">
            Stalled Deals Requiring Attention ({intel.stalledDeals.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {intel.stalledDeals.slice(0, 6).map((d) => (
              <span key={d.id} className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-800/40 px-3 py-1 text-xs font-medium text-amber-800 dark:text-amber-200">
                {d.accountName} — {d.daysInStage}d in {d.stage.replace(/_/g, " ")}
              </span>
            ))}
            {intel.stalledDeals.length > 6 && (
              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs text-amber-600">
                +{intel.stalledDeals.length - 6} more
              </span>
            )}
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-foreground mb-4">All Deals</h2>
          <PipelineTable deals={deals} />
        </div>
        <StageDistribution byStage={summary.byStage} />
      </div>
    </>
  );
}

export default function PipelinePage() {
  return (
    <>
      <PageHeader
        title="Pipeline"
        description="Lead → Demo → Pilot → Conversion lifecycle for all products."
      />
      <Suspense fallback={<><CardSkeleton count={4} /><div className="mt-8"><TableSkeleton /></div></>}>
        <PipelineContent />
      </Suspense>
    </>
  );
}
