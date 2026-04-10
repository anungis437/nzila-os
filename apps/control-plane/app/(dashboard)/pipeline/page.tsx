import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton, TableSkeleton } from "@/components/ui/loading";
import { SummaryCard } from "@/components/ui/summary-card";
import { PipelineTable } from "@/components/deal-engine/pipeline-table";
import { StageDistribution } from "@/components/deal-engine/stage-distribution";
import { TrendingUp, AlertTriangle, DollarSign, Clock } from "lucide-react";
import { getDeals, getPipelineSummary } from "@/server/deal-engine-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pipeline — Nzila OS Deal Engine",
  description: "Deal pipeline across all products and sources.",
};

async function PipelineContent() {
  const [deals, summary] = await Promise.all([getDeals(), getPipelineSummary()]);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
          value={summary.stalledDeals}
          subtitle=">14 days in stage"
        />
        <SummaryCard
          title="Avg. Days in Stage"
          icon={<Clock className="h-5 w-5" />}
          value={summary.averageDaysInStage}
          subtitle="across all active"
        />
      </div>

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
