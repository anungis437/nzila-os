# Continuity-Safe Rollout System

**Status:** Active
**Effective:** 2026-05-09
**Authority:** [master-rollout-governance-index.md](./master-rollout-governance-index.md)

---

## 1. Purpose

Rollout pacing is governed by **continuity-safe** principles. Pacing is
not optional and not adjustable by individual operators.

## 2. Pacing Primitives

| Primitive                  | Definition                                                  |
|----------------------------|-------------------------------------------------------------|
| Stabilization window       | Period after a promotion during which no further promotion. |
| Escalation pacing          | Minimum interval between escalations of the same incident.  |
| Onboarding pacing          | Minimum duration of each onboarding phase.                  |
| Modernization pacing       | Cadence at which doctrine/governance corpus updates emit.   |

## 3. Stabilization Windows

`continuity_window_minutes` per tier (registry):

| Tier     | Window                       |
|----------|------------------------------|
| dev      | 0                            |
| staging  | 60                           |
| demo     | 30                           |
| pilot    | 240                          |
| prod     | 1440 (24h)                   |

A new promotion to a tier inside its open window is refused by the
attestation recorder.

## 4. Escalation Pacing

Escalations follow [pilot-governance-system.md §9](./pilot-governance-system.md).
Re-escalation of the same incident requires a recorded justification.
Continuous escalation is treated as alert noise, not as urgency.

## 5. Onboarding Pacing

See [institutional-onboarding-governance.md §3](./institutional-onboarding-governance.md).

## 6. Modernization Pacing

Doctrine and governance corpus updates do not trigger automatic
deployments. Adoption follows the standard release cadence.

## 7. Governance-Safe Rollout Thresholds

| Threshold                                  | Action                          |
|--------------------------------------------|---------------------------------|
| > 2 simultaneous open continuity windows   | Pause all promotions.           |
| Open continuity window in `prod`           | Refuse all non-rollback events. |
| > 3 attestations marked HOLD in 24h        | Trigger readiness review.       |

## 8. UX Surfaces

- rollout pacing summary
- stabilization guidance panel
- rollout readiness band
- continuity-safe rollout indicator (calm; one badge)

## 9. Position

Rollout governance is never optimized for feature throughput. It is
optimized for institutional stabilization. This is the explicit
trade-off and it is intentional.
