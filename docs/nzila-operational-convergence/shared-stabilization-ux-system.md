# Shared Stabilization UX System

> **Status:** Canonical convergence · **Layer:** Stabilization UX · **Inherits:** [docs/nzila-governance-experience/governance-experience-design-system.md](../nzila-governance-experience/governance-experience-design-system.md)

## 1. Objective

Standardize stabilization-first UX behavior across the ecosystem so operators experience the same operational rhythm everywhere.

## 2. Canonical pacing

| Surface | Refresh cadence |
|---|---|
| Operations dashboards | ≥ 60s |
| Stabilization signals | ≥ 5 min |
| Continuity posture | ≥ 5 min |
| Executive briefings | On request only |
| Attestation lineage | On request only |

## 3. Operational density ceilings

- ≤ 6 cards per screen.
- ≤ 3 actions per card.
- ≤ 1 primary action per screen.
- ≤ 1 decision per session.
- ≤ 1 banded signal per card.

## 4. Governance-safe motion

- No motion in routine surfaces.
- Slow opacity transitions (≥ 200ms) only for cadence-bound refresh.
- No pulsing badges, no auto-scroll, no spinners during routine reads.

## 5. Continuity-safe transitions

Cross-page transitions preserve scroll position when re-entering the same surface. Tab switches do NOT trigger refetches faster than the cadence ceiling.

## 6. Explicitly prohibited

- Alert-wall UX.
- Operational panic states.
- Dashboard noise.
- Telemetry spectacle.
- Dopamine-driven operations interfaces.
- Toast notifications for routine governance events.

## 7. Required outputs

The cadence registry ships in [`@nzila/operational-convergence`](../../packages/operational-convergence) as `CANONICAL_CADENCE` and `cadenceFor(surface)`.

## 8. Discipline

A stabilization UX succeeds when operators describe the system as calm without prompting.
