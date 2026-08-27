# Release Governance Cadence

**Status:** Active
**Effective:** 2026-05-09
**Authority:** [master-rollout-governance-index.md](./master-rollout-governance-index.md)

---

## 1. Position

Release cadence at Nzila is optimized for **institutional stability**,
not for continuous-deployment maximalism. The cadence is deterministic
and reviewable.

## 2. Cadence Tiers

| Tier     | Cadence                                            |
|----------|----------------------------------------------------|
| dev      | Continuous, attested.                              |
| staging  | Daily review window; no weekend promotions.        |
| demo     | Per-release with platform review.                  |
| pilot    | Weekly review window; sponsor sign-off per release.|
| prod     | Bi-weekly review window; institutional sign-off.   |

## 3. Stabilization Windows

After every promotion to `demo`, `pilot`, or `prod` a stabilization
window opens (see `continuity_window_minutes` in the environment
registry). During the window:

- No further promotions to that tier.
- No optional configuration changes.
- Continuous legitimacy summary observation.

## 4. Promotion Sequencing

Sequencing rules:

1. A release reaches `prod` only via `pilot`.
2. A release reaches `pilot` only via `staging`.
3. A release does not skip a tier even when CI is green.
4. A release in active stabilization may not initiate a downstream
   promotion.

## 5. Attestation Cadence

| Surface                          | Cadence                          |
|----------------------------------|----------------------------------|
| Promotion attestation            | Per promotion event.             |
| Bootstrap attestation            | Per fresh-DB bootstrap.          |
| Pilot session attestation        | Per high-risk operator action.   |
| Demo session attestation         | Per demo session.                |
| Rollback attestation             | Per rollback event.              |
| Readiness review attestation     | Per scheduled review.            |

## 6. Rollback Governance

Rollback is a first-class release event with its own attestation, its
own review, and its own stabilization window. See
[governed-rollback-system.md](./governed-rollback-system.md).

## 7. Continuity-Safe Release Timing

- No promotion within the last business hour of a working day.
- No promotion during an open continuity window in any downstream tier.
- No bundling of unrelated changes into a single release for cadence
  efficiency.

## 8. Required UX Surfaces

- release review workflow
- release legitimacy summary
- stabilization window indicator
- attestation-linked release timeline
- deployment governance timeline
