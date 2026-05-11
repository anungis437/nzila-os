/**
 * Operational Proving Dashboard — Control Plane.
 *
 * Calm projection of the Phase C operational proving evidence.
 *
 * Authority: docs/nzila-operational-proving/master-operational-proving-index.md
 */
import { buildProvingSnapshot } from "@/lib/operational-proving";
import {
  ProvingChecklistPanel,
  RefusalCoveragePanel,
  RestorationPanel,
  RollbackProvingPanel,
  TraversalPanel,
} from "@/components/governance/proving/panels";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Operational Proving — Control Plane",
  description:
    "Phase C operational proving: traversal, refusals, rollback, restoration, closure.",
};

export default async function OperationalProvingPage() {
  const snapshot = await buildProvingSnapshot(3);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">
          Operational Proving
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Real evidence. Deterministic projection of the proving manifest and
          the rollout ledger.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TraversalPanel
          edges={snapshot.traversal.edges}
          coverage={snapshot.traversal.coverage}
          expected={snapshot.traversal.expected}
        />
        <RefusalCoveragePanel
          scenarios={snapshot.refusals.scenarios}
          logFound={snapshot.refusals.logFound}
        />
        <RollbackProvingPanel rollback={snapshot.rollback} />
        <RestorationPanel restoration={snapshot.restoration} />
        <div className="lg:col-span-2">
          <ProvingChecklistPanel
            rows={snapshot.checklist}
            release={snapshot.releaseUnderProving}
            recordedAt={snapshot.recordedAt}
          />
        </div>
      </div>

      <p className="mt-10 text-xs text-muted-foreground">
        Authority: docs/nzila-operational-proving/master-operational-proving-index.md
      </p>
    </div>
  );
}
