/**
 * Field Operations Dashboard — Control Plane.
 *
 * Calm, sparse, governance-readable surface for institutional field
 * operations. Deterministic projection of registry + attestation
 * ledgers; no per-app operational state.
 *
 * Authority: docs/nzila-field-operations/master-field-operations-index.md
 */
import { buildFieldOperationsSnapshot } from "@/lib/field-operations";
import {
  AuditPanel,
  CadencePanel,
  LifecyclePanel,
  RehearsalPanel,
  ReviewQueuePanel,
  StabilizationGuidancePanel,
  WorkflowPanel,
} from "@/components/governance/field-operations/panels";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Field Operations — Control Plane",
  description:
    "Operator cadence, governance review, stabilization, lifecycle, workflows, and audit.",
};

export default async function FieldOperationsPage() {
  const snapshot = await buildFieldOperationsSnapshot(3);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">
          Field Operations
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Stabilization-first. Cadence is interpretive. Reviews are calm.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CadencePanel rows={snapshot.cadence} />
        <ReviewQueuePanel rows={snapshot.reviewQueue} />
        <StabilizationGuidancePanel windows={snapshot.openContinuityWindows} />
        <WorkflowPanel rows={snapshot.openWorkflows} />
        <LifecyclePanel rows={snapshot.lifecycle} />
        <RehearsalPanel rows={snapshot.rehearsalRows} />
        <div className="lg:col-span-2">
          <AuditPanel rows={snapshot.audits} />
        </div>
      </div>

      <p className="mt-10 text-xs text-muted-foreground">
        Authority: docs/nzila-field-operations/master-field-operations-index.md
      </p>
    </div>
  );
}
