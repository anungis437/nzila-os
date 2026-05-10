# Governance Embodiment Consistency

> **Status:** Canonical convergence · **Layer:** Governance embodiment · **Inherits:** [docs/nzila-governance-experience/cross-product-governance-experience-fabric.md](../nzila-governance-experience/cross-product-governance-experience-fabric.md)

## 1. Objective

Ensure governance feels ambient, calm, and coherent across every Nzila product — never overbuilt in one app, never absent in another.

## 2. Standardized embodiments

| Aspect | Standard |
|---|---|
| Governance presentation | Posture card primitive (banded reading + cited interpretation) |
| Governance posture | One card per surface; one truth per card |
| Governance review | Append-only decision ledger; supersession visible |
| Governance interpretation | One institutional sentence per banding |
| Governance calmness | No animation; no urgency framing in routine surfaces |
| Governance evidence visibility | Read-only; content-hash citable |
| Governance review pacing | Cadence-bound (60s dashboards / 5min stabilization) |

## 3. Embodiment rules

- Every app reuses the governance experience primitives from [`@nzila/governance-operations`](../../packages/governance-operations) and [`@nzila/governance-review`](../../packages/governance-review).
- Bandings render with the same visual register everywhere.
- `rejected` is rendered honestly; silent downgrade is refused.
- Doctrine citations appear on every governance card.

## 4. Refused embodiments

- Per-app reinterpretation of bandings.
- Per-app traffic-light walls.
- Per-app composite governance scores.
- Per-app real-time governance feeds.

## 5. Required outputs

A `getGovernanceEmbodimentChecklist()` helper ships in [`@nzila/operational-convergence`](../../packages/operational-convergence) for app-side adherence checks.

## 6. Discipline

Governance succeeds when a stakeholder can move between products and never has to re-learn what governance looks like or means.
