# Onboarding Governance Operations

**Status:** Active
**Effective:** 2026-05-09
**Authority:** [master-field-operations-index.md](./master-field-operations-index.md)

This document operationalizes onboarding governance.

---

## 1. Posture

Onboarding optimizes for **institutional stabilization**, not for
rapid adoption. Time-to-active is not a metric. Stable handoff is.

---

## 2. Onboarding pacing

Pacing is phase-paced and minimum-bounded. The phases (canonical
across pilot and tenant onboarding):

| Phase                       | Minimum duration | Closes when                              |
| --------------------------- | ---------------- | ---------------------------------------- |
| Pre-onboarding review       | 5 business days  | Sponsor sign-off recorded                |
| Operator orientation        | 3 business days  | Operator roster published                |
| Shadow operations           | 5 business days  | Continuity-safe shadow attestation       |
| Supervised live operations  | 10 business days | Supervised handoff attestation           |

Phases never overlap.

---

## 3. Onboarding legitimacy

Onboarding is legitimate when:

- every phase closed with its required attestation
- no acceleration exception was recorded without sponsor + platform
  reviewer co-signature
- continuity windows were respected during all transitions

---

## 4. Onboarding stabilization

Each phase closes into a stabilization period before the next phase
opens. Stabilization periods are short (typically 1 business day)
and are intended to make the close visible to all reviewers.

---

## 5. Onboarding review cadence

Onboarding reviews are phase-paced:

- entry review (open the phase)
- mid-phase interpretive check
- exit review (close the phase + open the next)

Reviews are recorded into the reviews ledger.

---

## 6. Stakeholder onboarding sequencing

Stakeholder sequencing:

1. Sponsor (institutional)
2. Operators (platform-side)
3. Operators (institution-side)
4. End participants

Sequencing may not be reordered without a recorded exception.

---

## 7. Continuity-safe onboarding

If the target tier is inside a continuity window, the next
onboarding phase does not open. The phase waits.

---

## 8. Onboarding escalation handling

Escalation routes:

- continuity concern → continuity reviewer
- legitimacy concern → platform reviewer
- sponsor concern → executive

All escalations remain interpretive.

---

## 9. Surfaces

Onboarding posture is rendered in:

- Union Eyes → Pilot Governance · Onboarding Readiness
- Control Plane → Governance → Field Operations · Onboarding queue
