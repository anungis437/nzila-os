# Master Governance Experience Index

> **Status:** Canonical governance experience · **Layer:** Navigation · **Inherits:** [README.md](README.md)

## 1. Surfaces

| Surface | Doc | Implementation |
|---|---|---|
| Governance experience overview | [governance-experience-system.md](governance-experience-system.md) | `apps/control-plane/app/(dashboard)/governance-experience/page.tsx` |
| Live surfaces | [live-governance-surfaces.md](live-governance-surfaces.md) | `apps/control-plane/components/governance-experience` |
| Runtime UI embodiment | [runtime-ui-embodiment.md](runtime-ui-embodiment.md) | `apps/control-plane/components/governance-experience` |
| Operational workflows | [real-operational-workflows.md](real-operational-workflows.md) | `apps/control-plane/app/(dashboard)/governance-experience/review/page.tsx` |
| Operator validation | [institutional-operator-validation-program.md](institutional-operator-validation-program.md) | (program — not code) |
| Review experience | [governance-review-experience.md](governance-review-experience.md) | `apps/control-plane/app/(dashboard)/governance-experience/review/page.tsx` |
| Continuity experience | [continuity-posture-experience.md](continuity-posture-experience.md) | `apps/control-plane/app/(dashboard)/governance-experience/continuity/page.tsx` |
| Deployment legitimacy | [deployment-legitimacy-experience.md](deployment-legitimacy-experience.md) | `apps/control-plane/app/(dashboard)/governance-experience/legitimacy/page.tsx` |
| Evidence experience | [governance-evidence-experience.md](governance-evidence-experience.md) | (consumes ledger + projection primitives) |
| Executive experience | [executive-governance-experience.md](executive-governance-experience.md) | `apps/console/app/(dashboard)/governance-experience/page.tsx` |
| Live panels | [live-operational-governance-panels.md](live-operational-governance-panels.md) | `apps/control-plane/components/governance-experience` |
| Cross-product fabric | [cross-product-governance-experience-fabric.md](cross-product-governance-experience-fabric.md) | All apps consuming `@nzila/governance-operations` |
| Design system | [governance-experience-design-system.md](governance-experience-design-system.md) | Tokens in `@nzila/governance-operations/design-tokens` |

## 2. Reading paths

| Audience | Path |
|---|---|
| Executive | [executive-governance-experience.md](executive-governance-experience.md) → [continuity-posture-experience.md](continuity-posture-experience.md) → [governance-experience-readiness-review.md](governance-experience-readiness-review.md) |
| Governance officer | [live-governance-surfaces.md](live-governance-surfaces.md) → [governance-review-experience.md](governance-review-experience.md) → [deployment-legitimacy-experience.md](deployment-legitimacy-experience.md) |
| Designer | [governance-experience-design-system.md](governance-experience-design-system.md) → [runtime-ui-embodiment.md](runtime-ui-embodiment.md) |
| Auditor | [governance-evidence-experience.md](governance-evidence-experience.md) → [deployment-legitimacy-experience.md](deployment-legitimacy-experience.md) |
