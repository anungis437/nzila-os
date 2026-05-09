# Live Pilot Operations Proving

**Status:** Active · Proven 2026-05-09
**Authority:** [master-operational-proving-index.md](./master-operational-proving-index.md)

This document records the first proving cycle of real pilot
operational discipline.

---

## 1. Pilot tier state

| Field                       | Value                                              |
| --------------------------- | -------------------------------------------------- |
| Last promotion              | 2026-05-09T13:06:37Z                               |
| Release                     | `R-2026-05-09-PROVE`                               |
| Promotion attestation ID    | `585cfdd7-e2f8-423e-a543-feaa38aa86cd`             |
| Continuity window           | 240 minutes (open)                                 |
| Rollback recorded           | `d9ff190a-77d4-437d-b8dc-fc9f4861e8d9`             |
| Restoration recorded        | `8a63bb7b-75eb-480c-934c-6e7c589d5393`             |

---

## 2. Validations

| Validation                                  | Result |
| ------------------------------------------- | ------ |
| Pilot onboarding (phases defined; no acceleration) | PASS |
| Pilot cadence (daily light + weekly + bi-weekly + monthly) | PASS |
| Pilot governance review (sponsor + platform reviewers) | PASS |
| Pilot stabilization (240m window respected) | PASS   |
| Pilot readiness interpretation              | PASS   |
| Pilot continuity posture                    | PASS   |

---

## 3. Findings

| Category                      | Finding                                                      |
| ----------------------------- | ------------------------------------------------------------ |
| Pilot operational audits      | Pilot tier visible across UE, Control Plane, Console         |
| Onboarding findings           | Phase-paced; no acceleration exception                       |
| Stabilization findings        | Operator surface renders "Stabilizing" calmly                |
| Cadence observations          | Daily light cadence bounded; pilot operator load sustainable |

---

## 4. Refusal enforcement at the pilot tier

The continuity-window refusal at the pilot tier was demonstrated
during refusal proving (see
[promotion-refusal-proving.md](./promotion-refusal-proving.md)).

The pilot tier was correctly refused for reentry while inside its
240m window.

---

## 5. Posture

Pilot operations are operationally proven for the May 2026 cycle.
The pilot tier reads identically across operator, sponsor, and
executive surfaces.
