# Master Governance Operations Index

> **Status:** Canonical governance operations · **Layer:** Navigation · **Inherits:** [README.md](README.md)

## 1. Operations surfaces

| Surface | Doc | Implementation root |
|---|---|---|
| Operations dashboard | [governance-operations-dashboard-system.md](governance-operations-dashboard-system.md) | [packages/governance-operations](../../packages/governance-operations) |
| Continuity posture review | [continuity-posture-review-system.md](continuity-posture-review-system.md) | [packages/continuity-review](../../packages/continuity-review) |
| Attestation visibility | [runtime-attestation-visibility-system.md](runtime-attestation-visibility-system.md) | [packages/attestation-visibility](../../packages/attestation-visibility) |
| Evidence explorer | [governance-evidence-explorer.md](governance-evidence-explorer.md) | [packages/governance-operations](../../packages/governance-operations) |
| Stabilization signals | [stabilization-signals-system.md](stabilization-signals-system.md) | [packages/stabilization-signals](../../packages/stabilization-signals) |
| Executive review workflows | [executive-governance-review-workflows.md](executive-governance-review-workflows.md) | [packages/governance-review](../../packages/governance-review) |
| Deployment legitimacy review | [deployment-legitimacy-review-panels.md](deployment-legitimacy-review-panels.md) | [packages/attestation-visibility](../../packages/attestation-visibility) |
| Event interpretation | [governance-operations-event-interpretation.md](governance-operations-event-interpretation.md) | [packages/governance-operations](../../packages/governance-operations) |
| Role model | [governance-operations-role-model.md](governance-operations-role-model.md) | [packages/governance-operations](../../packages/governance-operations) |
| UI system | [governance-operations-ui-system.md](governance-operations-ui-system.md) | [packages/governance-operations](../../packages/governance-operations) |
| Live review panels | [live-governance-review-panels.md](live-governance-review-panels.md) | apps/control-plane, apps/console, ExecutiveOS, UE Ops |
| Cross-product fabric | [cross-product-governance-operations-fabric.md](cross-product-governance-operations-fabric.md) | All apps/* |

## 2. Reading paths by audience

| Audience | Path |
|---|---|
| Executive leadership | dashboard → continuity-posture → executive-review → readiness |
| Governance officers | dashboard → evidence-explorer → attestation-visibility → review |
| Platform operations | dashboard → stabilization-signals → deployment-legitimacy → event-interpretation |
| Auditors | attestation-visibility → evidence-explorer → readiness |
| Procurement observers | attestation-visibility → readiness |

## 3. Implementation packages

- [@nzila/governance-operations](../../packages/governance-operations)
- [@nzila/continuity-review](../../packages/continuity-review)
- [@nzila/attestation-visibility](../../packages/attestation-visibility)
- [@nzila/governance-review](../../packages/governance-review)
- [@nzila/stabilization-signals](../../packages/stabilization-signals)
