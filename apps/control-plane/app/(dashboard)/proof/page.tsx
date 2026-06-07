import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton } from "@/components/ui/loading";
import { SummaryCard } from "@/components/ui/summary-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ShieldCheck, FileCheck, Activity } from "lucide-react";
import { getAccountHealthRecords } from "@/server/deal-engine-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Proof — Nzila OS Deal Engine",
  description: "Account health, governance posture, and evidence packs.",
};

async function ProofContent() {
  const records = await getAccountHealthRecords();

  if (records.length === 0) {
    return <EmptyState title="No proof records" message="Account health and proof records will appear for active pilots." />;
  }

  const readyCount = records.filter((r) => r.proofStatus === "ready").length;
  const avgReadiness = Math.round(records.reduce((s, r) => s + r.readinessScore, 0) / records.length);
  const totalEvidence = records.reduce((s, r) => s + r.evidencePacksAvailable, 0);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard title="Accounts" icon={<ShieldCheck className="h-5 w-5" />} value={records.length} subtitle="with health tracking" />
        <SummaryCard title="Proof Ready" icon={<FileCheck className="h-5 w-5" />} value={readyCount} subtitle={`${records.length - readyCount} in progress`} />
        <SummaryCard title="Avg. Readiness" icon={<Activity className="h-5 w-5" />} value={`${avgReadiness}%`} subtitle="readiness score" />
        <SummaryCard title="Evidence Packs" icon={<ShieldCheck className="h-5 w-5" />} value={totalEvidence} subtitle="available" />
      </div>

      <h2 className="text-lg font-semibold text-foreground mb-4 mt-8">Account Health</h2>
      <div className="grid gap-6 md:grid-cols-2">
        {records.map((r) => (
          <div key={r.id} className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-foreground">{r.accountName}</h3>
                <p className="text-sm text-muted-foreground">Migration: {r.migrationHealth}</p>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-bold ${r.readinessScore >= 70 ? "text-emerald-600" : r.readinessScore >= 40 ? "text-amber-600" : "text-red-600"}`}>
                  {r.readinessScore}%
                </div>
                <p className="text-xs text-muted-foreground">readiness</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Ingestion:</span>{" "}
                <span className={r.ingestionSuccess ? "text-emerald-600" : "text-amber-600"}>
                  {r.ingestionSuccess === true ? "Success" : r.ingestionSuccess === false ? "Failed" : "Pending"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Trust:</span>{" "}
                <span className="text-foreground capitalize">{r.recommendationTrust}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Governance:</span>{" "}
                <span className={r.governancePosture === "compliant" ? "text-emerald-600" : "text-amber-600"}>
                  {r.governancePosture}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Proof:</span>{" "}
                <span className={r.proofStatus === "ready" ? "text-emerald-600 font-medium" : "text-amber-600"}>
                  {r.proofStatus.replace("_", " ")}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Evidence packs:</span>{" "}
                <span className="text-foreground">{r.evidencePacksAvailable}</span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Usage:</span>{" "}
                <span className="text-foreground">{r.productUsageSummary}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function ProofPage() {
  return (
    <>
      <PageHeader title="Proof" description="Account health, evidence packs, and governance posture for conversion readiness." />
      <Suspense fallback={<><CardSkeleton count={4} /><div className="mt-8"><CardSkeleton count={2} /></div></>}>
        <ProofContent />
      </Suspense>
    </>
  );
}
