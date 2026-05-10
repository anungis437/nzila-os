# Pilot Execution Discipline

**Status:** Active
**Effective:** 2026-05-09
**Authority:** [master-field-operations-index.md](./master-field-operations-index.md)

This document governs live institutional pilot operations.

---

## 1. Posture

Pilots are **institutionally governed deployments**, not beta
programs. Pilot operators are accountable to a sponsor and to
platform governance simultaneously.

---

## 2. Pilot readiness discipline

A pilot may not begin until all of the following are recorded:

- bootstrap attestation (ORM governance)
- per-pilot Key Vault provisioned and verified isolated
- promotion attestation `staging → pilot`
- sponsor sign-off (incident-tracker reference)
- operator roster published
- onboarding pacing initialized

This list is the canonical pilot readiness gate. The Pilot Readiness
Review panel in Union Eyes surfaces it.

---

## 3. Pilot onboarding pacing

| Phase                       | Minimum duration | Acceleration |
| --------------------------- | ---------------- | ------------ |
| Pre-onboarding review       | 5 business days  | Forbidden    |
| Operator orientation        | 3 business days  | By exception |
| Shadow operations           | 5 business days  | Forbidden    |
| Supervised live operations  | 10 business days | By exception |

Acceleration requires a recorded onboarding exception attestation per
[onboarding-governance-operations.md](./onboarding-governance-operations.md).

---

## 4. Pilot review cadence

| Cadence       | Reviewer            | Output                            |
| ------------- | ------------------- | --------------------------------- |
| Daily light   | Pilot operator      | Continuity check                  |
| Weekly        | Pilot + sponsor     | Stabilization review              |
| Bi-weekly     | Sponsor + platform  | Pilot legitimacy review           |
| Monthly       | Executive           | Pilot strategic interpretation    |

Cadence breaks are interpreted, not punished — but every break is
recorded.

---

## 5. Pilot stabilization windows

The pilot tier carries a 240-minute continuity window. No additional
promotion to pilot may occur during this window. Operator activity
during the window is restricted to continuity-safe operations only.

---

## 6. Pilot escalation handling

Escalation paths:

1. Operator → sponsor (continuity issues)
2. Sponsor → platform reviewer (legitimacy issues)
3. Platform reviewer → executive (strategic issues)

Escalation must remain calm, sparse, and continuity-safe.

---

## 7. Pilot legitimacy review

Pilot legitimacy is reviewed against:

- recorded attestation chain
- continuity posture
- operator cadence adherence
- onboarding pacing adherence
- sponsor satisfaction interpretation

A pilot whose legitimacy is unclear enters interpretive review,
not termination. Termination is governed separately and rarely.

---

## 8. Pilot continuity governance

The pilot tier follows the continuity-safe rollout system. Rollback
posture is governed per
[docs/nzila-rollout-governance/governed-rollback-system.md](../nzila-rollout-governance/governed-rollback-system.md).

---

## 9. Pilot operator expectations

Pilot operators are expected to:

- operate calmly
- defer to stabilization
- record attestations promptly
- escalate interpretively
- avoid heroics

Heroic operator behavior is itself a governance signal and is
reviewed.
