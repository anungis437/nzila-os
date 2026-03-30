import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton, TableSkeleton } from "@/components/ui/loading";
import { DecisionValueCards } from "@/components/decisions/decision-value-card";
import { DecisionProofPanel } from "@/components/decisions/decision-proof-panel";
import { DecisionBusinessImpactCard } from "@/components/decisions/decision-business-impact-card";
import { DecisionReviewBanner } from "@/components/decisions/decision-review-banner";
import { DecisionTable } from "@/components/decisions/decision-table";
import { getDecisions, getDecisionSummary } from "@/server/data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Decision Summary — Nzila OS Control Plane",
  description:
    "Executive summary of evidence-backed decisions, governance proof, and business impact.",
};

async function DecisionSummaryContent() {
  const [records, summary] = await Promise.all([
    getDecisions(),
    getDecisionSummary(),
  ]);

  const critical = records.filter(
    (r) =>
      r.severity === "CRITICAL" &&
      r.status !== "CLOSED" &&
      r.status !== "EXPIRED",
  );

  return (
    <>
      {/* Review status banner */}
      <DecisionReviewBanner
        pendingReview={summary.pending_review}
        criticalOpen={summary.critical_open}
      />

      {/* Value metrics */}
      <DecisionValueCards summary={summary} totalDecisions={summary.total} />

      {/* Business impact + Proof side-by-side */}
      <div className="grid gap-6 lg:grid-cols-2">
        <DecisionBusinessImpactCard decisions={records} />
        <div className="space-y-6">
          <DecisionProofPanel decisions={records} />
        </div>
      </div>

      {/* Critical decisions if any */}
      {critical.length > 0 && (
        <DecisionTable records={critical} title="Critical — Requires Attention" />
      )}
    </>
  );
}

export default function DecisionSummaryPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Decision Summary"
        description="Evidence-backed decisions, governance proof, and business impact at a glance."
      />
      <Suspense
        fallback={
          <div className="space-y-8">
            <CardSkeleton />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
            <TableSkeleton />
          </div>
        }
      >
        <DecisionSummaryContent />
      </Suspense>
    </div>
  );
}
