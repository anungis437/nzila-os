# Cross-App Operational Cadence

> **Status:** Canonical convergence · **Layer:** Cadence · **Inherits:** [shared-stabilization-ux-system.md](shared-stabilization-ux-system.md)

## 1. Objective

Standardize the operational rhythm of the ecosystem so cadence reinforces operational calmness and continuity.

## 2. Canonical cadence

| Domain | Cadence |
|---|---|
| Rollout window | Continuity-safe; bounded by stabilization signals |
| Review session | One decision per session |
| Governance posture refresh | ≥ 60s |
| Stabilization signal refresh | ≥ 5min |
| Onboarding cohort | Continuity-bounded; no acceleration on warming bandings |
| Modernization pacing | Bounded by `modernization-pacing` band; pause on `concerning` |
| Executive briefing | On request; never auto-pushed |

## 3. Required behavior

- A rollout MUST NOT proceed when the relevant stabilization band is `concerning` or `destabilizing`.
- A review session MUST NOT request more than one decision.
- A governance refresh MUST NOT exceed the cadence ceiling.

## 4. Required outputs

`CANONICAL_CADENCE` and `cadenceFor(domain)` ship in [`@nzila/operational-convergence`](../../packages/operational-convergence).

## 5. Discipline

Cadence succeeds when operators internalize a slow, deliberate institutional rhythm and stop expecting urgency from a routine surface.
