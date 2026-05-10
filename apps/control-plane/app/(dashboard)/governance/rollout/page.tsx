import { PageHeader } from "@/components/ui/page-header";
import { ContinuityWindowPanel } from "@/components/governance/rollout/continuity-window-panel";
import { EnvironmentLegitimacyPanel } from "@/components/governance/rollout/environment-legitimacy-panel";
import { PromotionLedgerViewer } from "@/components/governance/rollout/promotion-ledger-viewer";
import { PromotionReviewPanel } from "@/components/governance/rollout/promotion-review-panel";
import { RollbackGovernancePanel } from "@/components/governance/rollout/rollback-governance-panel";
import { RolloutAttestationViewer } from "@/components/governance/rollout/rollout-attestation-viewer";
import { RolloutReadinessPanel } from "@/components/governance/rollout/rollout-readiness-panel";
import {
  buildTierPostures,
  loadAttestationLedger,
  loadEnvironmentRegistry,
} from "@/lib/rollout-governance";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Rollout Governance — Nzila OS Control Plane",
  description:
    "Governed institutional rollout — environment legitimacy, promotion review, continuity posture, attestation lineage.",
};

export default async function RolloutGovernancePage() {
  const [registry, ledger] = await Promise.all([
    loadEnvironmentRegistry(),
    loadAttestationLedger(3),
  ]);
  const postures = buildTierPostures(registry, ledger);

  return (
    <div className="px-6 py-8">
      <PageHeader
        title="Rollout Governance"
        description="Governed institutional rollout posture across environments."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <RolloutReadinessPanel postures={postures} />
        </div>
        <div className="lg:col-span-1">
          <ContinuityWindowPanel postures={postures} />
        </div>
        <div className="lg:col-span-1">
          <PromotionReviewPanel registry={registry} postures={postures} />
        </div>
      </div>

      <div className="mt-6">
        <EnvironmentLegitimacyPanel postures={postures} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <PromotionLedgerViewer promotions={ledger.promotions} />
        <RollbackGovernancePanel
          postures={postures}
          rollbacks={ledger.rollbacks}
        />
      </div>

      <div className="mt-6">
        <RolloutAttestationViewer ledger={ledger} />
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        Authority:{" "}
        <code className="font-mono">
          docs/nzila-rollout-governance/master-rollout-governance-index.md
        </code>
      </p>
    </div>
  );
}
