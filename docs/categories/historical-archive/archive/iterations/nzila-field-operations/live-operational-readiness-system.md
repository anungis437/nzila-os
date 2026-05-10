# Live Operational Readiness System

**Status:** Active
**Effective:** 2026-05-09
**Authority:** [master-field-operations-index.md](./master-field-operations-index.md)

This document operationalizes readiness interpretation across
the Nzila ecosystem.

---

## 1. Posture

Readiness is **interpretive**, not score-maximization-oriented.
There are no readiness scores. There are readiness postures.

---

## 2. Readiness areas

| Area                  | Surface                                                |
| --------------------- | ------------------------------------------------------ |
| Rollout readiness     | Control Plane → Rollout · Rollout Readiness panel      |
| Onboarding readiness  | Union Eyes → Pilot Governance · Onboarding section     |
| Governance readiness  | Control Plane → Field Operations · Governance queue    |
| Environment readiness | Control Plane → Field Operations · Lifecycle dashboard |
| Pilot readiness       | Union Eyes → Pilot Governance · Pilot Legitimacy       |
| Continuity readiness  | Control Plane → Rollout · Continuity Window panel      |
| Executive readiness   | Console → Rollout Readiness                            |

---

## 3. Readiness postures

The canonical postures are:

- **READY** — cadence current, continuity calm, attestations clean.
- **STABILIZING** — continuity window open; defer.
- **REVIEWING** — interpretive review in progress.
- **WAITING** — preconditions not met; wait, do not push.
- **NOT YET PROVISIONED** — surface absent until provisioned.

Posture transitions are recorded in the reviews ledger when
significant.

---

## 4. Readiness summaries

Readiness summaries are calm and single-screen. They surface the
posture per area and an interpretive sentence per area.

---

## 5. Readiness interpretation flows

A reader interprets readiness by:

1. reading the posture
2. reading the interpretation sentence
3. consulting the linked authority document

Readiness UIs do not provide drill-down dashboards.

---

## 6. Readiness review workflows

Readiness reviews are phase-paced (onboarding) or cadence-paced
(governance, executive). They close into the reviews ledger.

---

## 7. No score gaming

Readiness must never become a score. The system intentionally:

- omits numeric scoring
- omits trend lines
- omits leaderboards
- omits readiness "improvement" prompts

A calm WAITING is more legitimate than a forced READY.
