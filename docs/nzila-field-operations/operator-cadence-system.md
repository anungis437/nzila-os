# Operator Cadence System

**Status:** Active
**Effective:** 2026-05-09
**Authority:** [master-field-operations-index.md](./master-field-operations-index.md)

This document establishes the canonical operational rhythm for
Nzila operators.

---

## 1. Operator types

| Operator type           | Primary surface                | Cadence         |
| ----------------------- | ------------------------------ | --------------- |
| Governance operator     | Control Plane → Governance     | Daily light     |
| Rollout operator        | Control Plane → Rollout        | Per-promotion   |
| Continuity reviewer     | Control Plane → Rollout        | Weekly          |
| Executive reviewer      | Console → Rollout Readiness    | Bi-weekly       |
| Onboarding operator     | Union Eyes → Pilot Governance  | Phase-paced     |
| Pilot operator          | Union Eyes → Pilot Governance  | Daily light     |
| Environment reviewer    | Control Plane → Rollout        | Per tier event  |

---

## 2. Cadence anatomy

Each cadence has:

- **Frequency** — how often the cadence is exercised.
- **Duration cap** — the soft cap on time spent per occurrence.
- **Output artifact** — the recorded attestation, note, or panel
  state that closes the cadence.

Cadence completion is **not** measured by activity volume.

---

## 3. Daily light cadence

A daily light cadence is a calm, sparse review of:

- environment posture (Environment Legitimacy panel)
- continuity windows (Continuity Window panel)
- recent attestations (Promotion Ledger / Attestations viewer)

Daily light cadence should not exceed 15 minutes per operator.

---

## 4. Weekly deep cadence

A weekly deep cadence reviews:

- rollout readiness (Rollout Readiness panel)
- rollback posture (Rollback Posture panel)
- onboarding pacing (Onboarding Readiness panel)

Weekly cadence outputs a recorded readiness attestation via
`node tooling/scripts/run-rollout-readiness-review.mjs`.

---

## 5. Stabilization pacing

When any tier is inside its continuity window, operators **defer**
non-continuity-safe activity. Cadence rhythms continue, but actions
are interpretive only.

---

## 6. Escalation cadence

Escalation is bounded:

- L1 → L2 within 1 business day for continuity issues
- L2 → L3 within 2 business days for legitimacy issues

No escalation may bypass governance review unless governed by
[docs/nzila-rollout-governance/continuity-safe-rollout-system.md](../nzila-rollout-governance/continuity-safe-rollout-system.md).

---

## 7. Continuity review cadence

The continuity reviewer maintains a calm weekly review of the
continuity-safe rollout posture. The review is interpretive — it
identifies stabilization risk, not operator failure.

---

## 8. Onboarding review cadence

Onboarding cadence is **phase-paced**, not calendar-paced. A phase
closes only when its readiness criteria are met.

---

## 9. Rollout review rhythm

Rollout review is **per-promotion plus weekly**. The per-promotion
review is recorded as an attestation. The weekly review aggregates
posture across the registry.

---

## 10. Operational calmness

Cadence reinforces calmness by:

- bounding review duration
- bounding escalation latency
- preferring interpretation over enforcement
- avoiding alert fatigue
- recording absence of activity as legitimate

A quiet week is a healthy week.
