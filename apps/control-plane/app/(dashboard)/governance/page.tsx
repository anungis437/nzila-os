import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton, TableSkeleton } from "@/components/ui/loading";
import { StatusBadge } from "@/components/ui/status-badge";
import { SummaryCard } from "@/components/ui/summary-card";
import { Shield, FileCheck, Clock, Database, Workflow } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import {
  getGovernanceStatusData,
  getGovernanceTimeline,
  getProcurementSummary,
} from "@/server/data";
import { getWorkflowSummary } from "@/server/workflow-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Governance — Nzila OS Control Plane",
  description: "Governance status, evidence verification, and compliance timeline.",
};

async function GovernanceContent() {
  const [status, timeline, procurement, workflowSummary] = await Promise.all([
    getGovernanceStatusData(),
    getGovernanceTimeline(),
    getProcurementSummary(),
    getWorkflowSummary(),
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

      {/* Governed Workflows */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Governed Workflows
        </h2>
        <div className="grid gap-4 md:grid-cols-4 mb-4">
          <SummaryCard
            title="Registered"
            icon={<Workflow className="h-5 w-5" />}
            value={workflowSummary.totalRegistered}
          />
          <SummaryCard
            title="With Ingestion"
            icon={<Database className="h-5 w-5" />}
            value={workflowSummary.withIngestion}
          />
          <SummaryCard
            title="With FSM"
            icon={<Shield className="h-5 w-5" />}
            value={workflowSummary.withFsm}
          />
          <SummaryCard
            title="With Evidence"
            icon={<FileCheck className="h-5 w-5" />}
            value={workflowSummary.withEvidence}
          />
        </div>
        <div className="rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Workflow</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Version</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Ingestion</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">FSM</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {workflowSummary.workflows.map((w) => (
                <tr key={`${w.name}@${w.version}`} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{w.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{w.version}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={w.hasIngestion ? "healthy" : "degraded"} label={w.hasIngestion ? "Yes" : "No"} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={w.hasFsm ? "healthy" : "degraded"} label={w.hasFsm ? "Yes" : "No"} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={w.hasEvidence ? "healthy" : "degraded"} label={w.hasEvidence ? "Yes" : "No"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
