import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton } from "@/components/ui/loading";
import { DecisionEvidencePanel } from "@/components/decisions/decision-evidence-panel";
import { getDecisionById } from "@/server/data";

export const dynamic = "force-dynamic";

async function DecisionDetailContent({ id }: { id: string }) {
  const decision = await getDecisionById(id);
  if (!decision) return notFound();
  return <DecisionEvidencePanel decision={decision} />;
}

export default async function DecisionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="space-y-8">
      <PageHeader
        title="Decision Detail"
        description={`Viewing decision ${id}`}
      />
      <Suspense fallback={<CardSkeleton />}>
        <DecisionDetailContent id={id} />
      </Suspense>
    </div>
  );
}
