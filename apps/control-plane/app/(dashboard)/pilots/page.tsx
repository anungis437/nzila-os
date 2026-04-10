import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton } from "@/components/ui/loading";
import { SummaryCard } from "@/components/ui/summary-card";
import { PilotCard } from "@/components/deal-engine/pilot-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Rocket, CheckCircle, AlertTriangle } from "lucide-react";
import { getPilots } from "@/server/deal-engine-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pilots — Nzila OS Deal Engine",
  description: "Active pilots, checklists, and ingestion status.",
};

async function PilotsContent() {
  const pilots = await getPilots();

  if (pilots.length === 0) {
    return <EmptyState title="No pilots yet" message="Pilots will appear once deals progress to the pilot stage." />;
  }

  const active = pilots.filter((p) => p.pilotStatus === "active" || p.pilotStatus === "ingestion" || p.pilotStatus === "data_collection");
  const blocked = pilots.filter((p) => p.currentBlockers.length > 0);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          title="Total Pilots"
          icon={<Rocket className="h-5 w-5" />}
          value={pilots.length}
          subtitle={`${active.length} active`}
        />
        <SummaryCard
          title="Avg. Checklist"
          icon={<CheckCircle className="h-5 w-5" />}
          value={`${Math.round(
            (pilots.reduce((s, p) => {
              const c = p.checklist;
              return s + [c.dataReceived, c.ingestionComplete, c.demoDatasetReady, c.userOnboardingComplete, c.reviewMeetingScheduled, c.conversionTriggered].filter(Boolean).length;
            }, 0) / (pilots.length * 6)) * 100
          )}%`}
          subtitle="completion rate"
        />
        <SummaryCard
          title="Blocked"
          icon={<AlertTriangle className="h-5 w-5" />}
          value={blocked.length}
          subtitle="pilots with blockers"
        />
      </div>

      <h2 className="text-lg font-semibold text-foreground mb-4 mt-8">Active Pilots</h2>
      <div className="grid gap-6 md:grid-cols-2">
        {pilots.map((pilot) => (
          <PilotCard key={pilot.id} pilot={pilot} />
        ))}
      </div>
    </>
  );
}

export default function PilotsPage() {
  return (
    <>
      <PageHeader
        title="Pilots"
        description="Pilot operations with checklist visibility and ingestion status."
      />
      <Suspense fallback={<><CardSkeleton count={3} /><div className="mt-8"><CardSkeleton count={2} /></div></>}>
        <PilotsContent />
      </Suspense>
    </>
  );
}
