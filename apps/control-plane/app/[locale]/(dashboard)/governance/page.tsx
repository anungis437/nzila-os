import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton, TableSkeleton } from "@/components/ui/loading";
import { StatusBadge } from "@/components/ui/status-badge";
import { SummaryCard } from "@/components/ui/summary-card";
import { Shield, FileCheck, Clock, Database } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import {
  getGovernanceStatusData,
  getGovernanceTimeline,
  getProcurementSummary,
} from "@/server/data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Governance — Nzila OS Control Plane",
  description: "Governance status, evidence verification, and compliance timeline.",
};

async function GovernanceContent() {
  const [status, timeline, procurement] = await Promise.all([
    getGovernanceStatusData(),
    getGovernanceTimeline(),
    getProcurementSummary(),
  ]);

  return (
    <>
      {/* Current state cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Policy Engine"
          icon={<Shield className="h-5 w-5" />}
          value={<StatusBadge status={status.policy_engine} />}
        />
        <SummaryCard
          title="Evidence Pack"
          icon={<FileCheck className="h-5 w-5" />}
          value={<StatusBadge status={status.evidence_pack} />}
        />
        <SummaryCard
          title="Compliance Snapshot"
          icon={<Database className="h-5 w-5" />}
          value={<StatusBadge status={status.compliance_snapshot} />}
        />
        <SummaryCard
          title="SBOM"
          icon={<Clock className="h-5 w-5" />}
          value={
            <StatusBadge
              status={status.sbom_current ? "current" : "stale"}
              label={status.sbom_current ? "Current" : "Outdated"}
            />
          }
        />
      </div>

      {/* Last procurement pack */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Latest Procurement Pack
        </h2>
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Pack ID</p>
              <p className="text-sm font-mono font-medium text-foreground mt-1">
                {procurement.packId}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Signature</p>
              <div className="mt-1">
                <StatusBadge status={procurement.signatureStatus} />
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Attestation</p>
              <div className="mt-1">
                <StatusBadge status={procurement.attestationStatus} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Audit timeline */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Governance Audit Timeline
        </h2>
        <div className="space-y-3">
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No governance events recorded.
            </p>
          ) : (
            timeline.map((entry, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-border bg-card p-4 flex items-center gap-4"
              >
                <div
                  className={`h-2 w-2 rounded-full ${
                    entry.policy_result === "pass"
                      ? "bg-emerald-500"
                      : entry.policy_result === "warn"
                        ? "bg-amber-500"
                        : "bg-red-500"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">
                      {entry.event_type.replace(/_/g, " ")}
                    </span>
                    <StatusBadge status={entry.policy_result === "pass" ? "healthy" : entry.policy_result === "warn" ? "degraded" : "failed"} label={entry.policy_result} />
                    <span className="text-xs text-muted-foreground">
                      by {entry.actor}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDateTime(entry.timestamp)} · {entry.source} · {entry.commit_hash}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

export default function GovernancePage() {
  return (
    <>
      <PageHeader
        title="Governance"
        description="Visual proof center for operators and buyers — governance status, evidence packs, compliance snapshots."
      />
      <Suspense
        fallback={
          <>
            <CardSkeleton count={4} />
            <div className="mt-8">
              <TableSkeleton rows={4} />
            </div>
          </>
        }
      >
        <GovernanceContent />
      </Suspense>
    </>
  );
}
