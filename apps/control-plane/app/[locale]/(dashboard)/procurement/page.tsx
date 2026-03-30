import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton } from "@/components/ui/loading";
import { StatusBadge } from "@/components/ui/status-badge";
import { SummaryCard } from "@/components/ui/summary-card";
import { formatDateTime } from "@/lib/utils";
import { getProcurementSummary } from "@/server/data";
import { Shield, FileText, Hash, CheckCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Procurement — Nzila OS Control Plane",
  description: "Procurement evidence pack and supply-chain attestation.",
};

async function ProcurementContent() {
  const pack = await getProcurementSummary();

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Pack ID"
          value={pack.packId}
          icon={<FileText className="h-4 w-4" />}
        />
        <SummaryCard
          title="Signature"
          value={pack.signatureStatus}
          icon={<Shield className="h-4 w-4" />}
        />
        <SummaryCard
          title="Attestation"
          value={pack.attestationStatus}
          icon={<CheckCircle className="h-4 w-4" />}
        />
        <SummaryCard
          title="Generated"
          value={formatDateTime(pack.createdAt)}
          icon={<Hash className="h-4 w-4" />}
        />
      </div>

      {/* Detail Section */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-6">
        <h2 className="text-sm font-semibold text-foreground">
          Evidence Pack Details
        </h2>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Manifest Hash */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Manifest Hash
            </p>
            <code className="block text-xs font-mono text-foreground bg-muted rounded p-2 break-all">
              {pack.manifestHash}
            </code>
          </div>

          {/* SBOM Reference */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">
              SBOM Reference
            </p>
            <code className="block text-xs font-mono text-foreground bg-muted rounded p-2 break-all">
              {pack.sbomRef}
            </code>
          </div>

          {/* Signature Status */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Signature Status
            </p>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge
                status={
                  pack.signatureStatus === "verified"
                    ? "healthy"
                    : pack.signatureStatus === "failed"
                      ? "failed"
                      : "unknown"
                }
                label={pack.signatureStatus}
              />
            </div>
          </div>

          {/* Attestation Status */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Attestation Status
            </p>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge
                status={
                  pack.attestationStatus === "valid"
                    ? "healthy"
                    : pack.attestationStatus === "expired"
                      ? "degraded"
                      : "failed"
                }
                label={pack.attestationStatus}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Supply Chain Sections */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">
          Supply-Chain Evidence Sections
        </h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {(
            [
              "Security Posture",
              "Data Lifecycle",
              "Operational Evidence",
              "Governance Evidence",
              "Sovereignty Profile",
            ] as const
          ).map((section) => (
            <div
              key={section}
              className="flex items-center justify-between rounded-md border border-border p-3"
            >
              <span className="text-xs text-foreground">{section}</span>
              <StatusBadge status="healthy" label="included" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ProcurementPage() {
  return (
    <>
      <PageHeader
        title="Procurement"
        description="One-click evidence aggregation for procurement and compliance."
      />
      <Suspense fallback={<CardSkeleton count={4} />}>
        <ProcurementContent />
      </Suspense>
    </>
  );
}
