import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton } from "@/components/ui/loading";
import { SummaryCard } from "@/components/ui/summary-card";
import { FollowUpList } from "@/components/deal-engine/follow-up-list";
import { EmptyState } from "@/components/ui/empty-state";
import { Bell, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { getFollowUps } from "@/server/deal-engine-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Follow-ups — Nzila OS Deal Engine",
  description: "Automated follow-ups and actionable reminders.",
};

async function FollowUpsContent() {
  const followUps = await getFollowUps();

  if (followUps.length === 0) {
    return <EmptyState title="No follow-ups" message="Follow-ups will appear as deals progress." />;
  }

  const overdue = followUps.filter((f) => f.isOverdue).length;
  const completed = followUps.filter((f) => f.completedAt != null).length;
  const open = followUps.length - completed;
  const highPriority = followUps.filter((f) => f.priority === "high" || f.priority === "critical").length;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Open"
          icon={<Bell className="h-5 w-5" />}
          value={open}
          subtitle={`${followUps.length} total`}
        />
        <SummaryCard
          title="Overdue"
          icon={<AlertTriangle className="h-5 w-5" />}
          value={overdue}
          subtitle={overdue > 0 ? "needs attention" : "all on track"}
        />
        <SummaryCard
          title="High/Critical"
          icon={<Clock className="h-5 w-5" />}
          value={highPriority}
          subtitle="priority items"
        />
        <SummaryCard
          title="Completed"
          icon={<CheckCircle className="h-5 w-5" />}
          value={completed}
          subtitle={followUps.length > 0 ? `${Math.round((completed / followUps.length) * 100)}% done` : "—"}
        />
      </div>

      <h2 className="text-lg font-semibold text-foreground mb-4 mt-8">All Follow-ups</h2>
      <FollowUpList followUps={followUps} />
    </>
  );
}

export default function FollowUpsPage() {
  return (
    <>
      <PageHeader
        title="Follow-ups"
        description="Automated follow-ups triggered by deal stage transitions and checklist gaps."
      />
      <Suspense fallback={<><CardSkeleton count={4} /><div className="mt-8"><CardSkeleton count={5} /></div></>}>
        <FollowUpsContent />
      </Suspense>
    </>
  );
}
