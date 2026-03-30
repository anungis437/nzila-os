import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton, TableSkeleton } from "@/components/ui/loading";
import { DecisionSummaryCards } from "@/components/decisions/decision-summary-cards";
import { DecisionTable } from "@/components/decisions/decision-table";
import { getDecisions, getDecisionSummary } from "@/server/data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Decisions — Nzila OS Control Plane",
  description: "Decision Layer — evidence-backed recommendations, approvals, and audit trail.",
};

async function DecisionsContent() {
  const [records, summary] = await Promise.all([
    getDecisions(),
    getDecisionSummary(),
  ]);

  const pending = records.filter(
    (r) => r.status === "GENERATED" || r.status === "PENDING_REVIEW",
  );
  const critical = records.filter(
    (r) =>
      r.severity === "CRITICAL" &&
      r.status !== "CLOSED" &&
      r.status !== "EXPIRED",
  );

  return (
    <>
      <DecisionSummaryCards summary={summary} />

      {critical.length > 0 && (
        <div className="mt-8">
          <DecisionTable records={critical} title="Critical Decisions" />
        </div>
      )}

      {pending.length > 0 && (
        <div className="mt-8">
          <DecisionTable records={pending} title="Pending Review" />
        </div>
      )}

      <div className="mt-8">
        <DecisionTable records={records} title="All Decisions" />
      </div>
    </>
  );
}

export default function DecisionsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Decisions"
        description="Evidence-backed decision recommendations, approvals, and audit trail."
      />
      <Suspense
        fallback={
          <div className="space-y-8">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
            <TableSkeleton />
          </div>
        }
      >
        <DecisionsContent />
      </Suspense>
    </div>
  );
}
