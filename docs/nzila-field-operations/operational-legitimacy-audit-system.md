# Operational Legitimacy Audit System

**Status:** Active
**Effective:** 2026-05-09
**Authority:** [master-field-operations-index.md](./master-field-operations-index.md)

This document defines the continuous validation of field
operational legitimacy.

---

## 1. Posture

Audits are **governance-readable**, not compliance bureaucracy.
Audit output is a calm interpretive summary, not a checklist score.

---

## 2. Audit categories

| Audit                           | Authority                                |
| ------------------------------- | ---------------------------------------- |
| Cadence adherence               | operator-cadence-system.md               |
| Stabilization adherence         | stabilization-operations-system.md       |
| Governance review completion    | governance-review-cadence.md             |
| Onboarding legitimacy           | onboarding-governance-operations.md      |
| Rollout legitimacy              | nzila-rollout-governance corpus          |
| Environment legitimacy          | environment-lifecycle-governance.md      |
| Operator continuity posture     | operator-cadence-system.md               |

---

## 3. Audit cadence

Audits run weekly via `pnpm field-ops:validate`. Output is recorded
to `proof-artifacts/field-operations-audits/audit-YYYY-MM-DD.json`.

---

## 4. Audit panels

Audit results are surfaced in:

- Control Plane → Governance → Field Operations · Audit panel

The panel renders:

- last audit timestamp
- per-category posture (`OK`, `INTERPRETIVE`, `REFUSED`)
- a single interpretive sentence per category

---

## 5. Cadence audit summaries

A cadence audit summary lists cadences that have not produced their
expected artifact in the last cadence period. The summary is
interpretive — a missed cadence triggers review, not penalty.

---

## 6. Stabilization audit summaries

A stabilization audit summary verifies that continuity windows have
been respected (no promotions during open windows; no onboarding
phase transitions during open windows).

---

## 7. Operational continuity audits

A continuity audit verifies that no continuity-safe rule was
bypassed in the audit period. Bypasses, if any, must have a
recorded exception attestation.

---

## 8. Refusal posture

The audit system **refuses** to render any of:

- per-operator scorecards
- ranked operator lists
- numeric "audit scores"

These are anti-governance and would corrupt the cadence model.

---

## 9. Posture

Audits exist to keep the ecosystem honest with itself, not to
produce compliance artifacts for external consumption.
