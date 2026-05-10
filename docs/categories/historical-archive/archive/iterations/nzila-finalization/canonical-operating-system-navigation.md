# Canonical Operating System Navigation

**Status:** Active
**Effective:** 2026-05-09
**Authority:** [master-finalization-index.md](./master-finalization-index.md)

This document finalizes the canonical operational navigation grammar
across the Nzila ecosystem.

---

## 1. Operational information architecture

Every operator-facing app exposes the same top-level groupings:

| Grouping        | Intent                                               |
| --------------- | ---------------------------------------------------- |
| Operations      | Day-to-day operator surfaces                         |
| Governance      | Doctrine-anchored review surfaces                    |
| Rollout         | Promotion / rollback / restoration surfaces          |
| Continuity      | Continuity-window posture and stabilization          |
| Legitimacy      | Audits, certifications, proving                      |

Apps may omit groupings that do not apply to their operator role,
but they MUST NOT introduce competing groupings.

---

## 2. Per-app canonical placement

| Surface                                | App           | Grouping     |
| -------------------------------------- | ------------- | ------------ |
| Field Operations                       | Control Plane | Governance   |
| Rollout                                | Control Plane | Rollout      |
| Operational Proving                    | Control Plane | Legitimacy   |
| Final GO Status                        | Control Plane | Legitimacy   |
| Field Operations Briefing              | Console       | Operations   |
| Rollout Readiness                      | Console       | Rollout      |
| Operational Proving Summary            | Console       | Legitimacy   |
| Final GO Briefing                      | Console       | Legitimacy   |
| Pilot Governance                       | UE            | Governance   |
| Field Operations                       | UE            | Operations   |
| Operational Proving (pilot view)       | UE            | Legitimacy   |
| Final GO (pilot view)                  | UE            | Legitimacy   |

---

## 3. Navigation grammar rules

- Single authority per grouping. No grouping has two parents.
- Surfaces inside a grouping share doctrine authority.
- Navigation is role-aware but vocabulary-stable.
- Review transitions never require deep linking.
- No grouping introduces a "score", "metric center", or "leaderboard".

---

## 4. Role-based posture

| Role                     | Primary grouping  | Secondary groupings                  |
| ------------------------ | ----------------- | ------------------------------------ |
| Executive                | Operations        | Legitimacy                           |
| Governance operator      | Governance        | Rollout, Legitimacy                  |
| Rollout operator         | Rollout           | Continuity                           |
| Onboarding operator      | Operations        | Governance                           |
| Continuity reviewer      | Continuity        | Governance                           |
| Pilot operator           | Operations        | Governance, Legitimacy               |
| Steward / reviewer       | Governance        | Legitimacy                           |
| Administrator            | Operations        | Rollout, Continuity, Legitimacy      |

---

## 5. Posture

Operators feel that they are operating one system. Surface naming,
posture vocabulary, and authority links converge across apps.
