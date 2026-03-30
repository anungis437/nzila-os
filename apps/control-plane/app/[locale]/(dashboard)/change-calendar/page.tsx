import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton, TableSkeleton } from "@/components/ui/loading";
import { SummaryCard } from "@/components/ui/summary-card";
import { Calendar, Shield, AlertTriangle } from "lucide-react";
import { CalendarView } from "@/components/changes/calendar-view";
import { PIRSummaryCard } from "@/components/changes/pir-summary-card";
import { getChangeCalendarData } from "@/server/data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Change Calendar — Nzila OS Control Plane",
  description: "Upcoming change windows for staging and production environments.",
};

async function CalendarContent() {
  const { staging, production, pendingPIR } = await getChangeCalendarData();

  return (
    <>
      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          title="Staging Changes"
          icon={<Calendar className="h-5 w-5" />}
          value={staging.length}
        />
        <SummaryCard
          title="Production Changes"
          icon={<Shield className="h-5 w-5" />}
          value={production.length}
        />
        <SummaryCard
          title="Pending PIR"
          icon={<AlertTriangle className="h-5 w-5" />}
          value={pendingPIR.length}
        />
      </div>

      {/* Calendar view */}
      <div className="mt-8">
        <CalendarView staging={staging} production={production} />
      </div>

      {/* PIR reminders */}
      {pendingPIR.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Post Implementation Reviews Needed
          </h2>
          <div className="space-y-3">
            {pendingPIR.map((r) => (
              <PIRSummaryCard key={r.change_id} record={r} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default function ChangeCalendarPage() {
  return (
    <div>
      <PageHeader
        title="Change Calendar"
        description="Upcoming change windows across staging and production environments."
      />
      <Suspense
        fallback={
          <>
            <CardSkeleton count={3} />
            <div className="mt-8">
              <TableSkeleton rows={4} />
            </div>
          </>
        }
      >
        <CalendarContent />
      </Suspense>
    </div>
  );
}
