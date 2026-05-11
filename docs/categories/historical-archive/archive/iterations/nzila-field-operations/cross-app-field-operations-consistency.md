# Cross-App Field Operations Consistency

**Status:** Active
**Effective:** 2026-05-09
**Authority:** [master-field-operations-index.md](./master-field-operations-index.md)

This document governs operational consistency across the Nzila
ecosystem during live operations.

---

## 1. Aligned applications

Field operations consistency applies to:

- Union Eyes (sponsor + pilot operator surface)
- Control Plane (governance + rollout + field operations)
- Console (executive surface)
- ExecutiveOS (executive package consumed by Console)
- UE Ops (pilot operator surface)

---

## 2. Standardized concepts

The following concepts have a single canonical interpretation across
all applications:

| Concept              | Canonical interpretation                          |
| -------------------- | ------------------------------------------------- |
| Operational cadence  | per operator-cadence-system.md                    |
| Stabilization        | per stabilization-operations-system.md            |
| Readiness            | per live-operational-readiness-system.md          |
| Governance review    | per governance-review-cadence.md                  |
| Onboarding           | per onboarding-governance-operations.md           |
| Rollout review       | per nzila-rollout-governance corpus               |
| Executive briefing   | per executive-briefing-rhythm.md                  |

---

## 3. Standardized vocabulary

| Term            | Use                                                    |
| --------------- | ------------------------------------------------------ |
| Stabilizing     | Continuity window open                                  |
| Observed        | Stable, under cadence review                            |
| Waiting         | Preconditions not met                                   |
| Reviewing       | Interpretive review in progress                         |
| Not provisioned | Surface absent until provisioned                        |

These terms appear identically in every operator-facing surface.

---

## 4. Standardized posture rendering

Posture rendering rules across apps:

- Calm color: gray-900 text on white card.
- Stabilizing color: amber-700 text. No flashing, no pulsing.
- Reviewing color: gray-700 italic.
- No red unless an attestation chain is broken.

---

## 5. Standardized refusals

Operator refusals (continuity refusal, out-of-graph refusal) render
identically: a calm sentence stating what was refused and why, with
a link to the authority document.

---

## 6. Cross-app deterministic projection

All field operations surfaces are deterministic projections of:

- `governance/foundations/rollout/environments.json`
- `proof-artifacts/rollout-attestations/*.jsonl`

There is no per-app operational state. There is no per-app cache
that can drift.

---

## 7. Posture

Live operations must feel ecosystem-native — a sponsor, an
operator, a reviewer, and an executive all read the same posture.
