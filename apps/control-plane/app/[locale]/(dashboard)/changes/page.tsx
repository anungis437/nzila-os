import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton, TableSkeleton } from "@/components/ui/loading";
import { SummaryCard } from "@/components/ui/summary-card";
import {
  GitPullRequest,
  Clock,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { ChangeRecordTable } from "@/components/changes/change-record-table";
import { PIRSummaryCard } from "@/components/changes/pir-summary-card";
import { getChangeRecords } from "@/server/data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Changes — Nzila OS Control Plane",
  description: "Change Enablement records, approvals, and post-implementation reviews.",
};

async function ChangesContent() {
  const records = await getChangeRecords();

  const pending = records.filter((r) => r.approval_status === "PENDING");
  const stagingUpcoming = records.filter(
    (r) =>
      r.environment === "STAGING" &&
      (r.status === "APPROVED" || r.status === "SCHEDULED"),
  );
  const prodUpcoming = records.filter(
    (r) =>
      r.environment === "PROD" &&
      (r.status === "APPROVED" || r.status === "SCHEDULED"),
  );
  const emergency = records.filter((r) => r.change_type === "EMERGENCY");
  const awaitingPIR = records.filter(
    (r) =>
      (r.change_type === "NORMAL" || r.change_type === "EMERGENCY") &&
      (r.status === "COMPLETED" || r.status === "FAILED" || r.status === "ROLLED_BACK") &&
      !r.post_implementation_review,
  );

  return (
    <>
      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Pending Approvals"
          icon={<Clock className="h-5 w-5" />}
          value={pending.length}
        />
        <SummaryCard
          title="Staging Upcoming"
          icon={<GitPullRequest className="h-5 w-5" />}
          value={stagingUpcoming.length}
        />
        <SummaryCard
          title="Production Upcoming"
          icon={<AlertTriangle className="h-5 w-5" />}
          value={prodUpcoming.length}
        />
        <SummaryCard
          title="Awaiting PIR"
          icon={<CheckCircle className="h-5 w-5" />}
          value={awaitingPIR.length}
        />
      </div>

      {/* Emergency changes */}
      {emergency.length > 0 && (
        <div className="mt-8">
          <ChangeRecordTable records={emergency} title="Emergency Changes" />
        </div>
      )}

      {/* Pending approvals */}
      {pending.length > 0 && (
        <div className="mt-8">
          <ChangeRecordTable records={pending} title="Pending Approvals" />
        </div>
      )}

      {/* Changes awaiting PIR */}
      {awaitingPIR.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Awaiting Post Implementation Review
          </h2>
          <div className="space-y-3">
            {awaitingPIR.map((r) => (
              <PIRSummaryCard key={r.change_id} record={r} />
            ))}
          </div>
        </div>
      )}

      {/* All changes */}
      <div className="mt-8">
        <ChangeRecordTable records={records} title="All Change Records" />
      </div>
    </>
  );
}

export default function ChangesPage() {
  return (
    <div>
      <PageHeader
        title="Change Enablement"
        description="ITIL-aligned change records, approval tracking, and post-implementation reviews."
      />
      <Suspense
        fallback={
          <>
            <CardSkeleton count={4} />
            <div className="mt-8">
              <TableSkeleton rows={5} />
            </div>
          </>
        }
      >
        <ChangesContent />
      </Suspense>
    </div>
  );
}
