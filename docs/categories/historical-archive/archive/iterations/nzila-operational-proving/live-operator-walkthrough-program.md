# Live Operator Walkthrough Program

**Status:** Active · Initial cycle 2026-05-09
**Authority:** [master-operational-proving-index.md](./master-operational-proving-index.md)

This document records the operator walkthrough cycle that exercises
real workflows under cadence conditions.

---

## 1. Operator coverage

| Operator type        | Walkthrough                                | Status |
| -------------------- | ------------------------------------------ | ------ |
| Governance operator  | Cadence review on Field Operations dashboard | DONE  |
| Rollout operator     | Promotion review (4 promotions executed)   | DONE   |
| Onboarding operator  | Onboarding panel readability check         | DONE   |
| Continuity reviewer  | Continuity window interpretation           | DONE   |
| Executive reviewer   | Console rollout readiness + briefing       | DONE   |
| Pilot operator       | Union Eyes pilot governance walkthrough    | DONE   |

---

## 2. Walkthroughs executed

Each walkthrough was performed against the live ledger after the
traversal in [full-environment-traversal-rehearsal.md](./full-environment-traversal-rehearsal.md).

### Rollout review
- Surface: Control Plane → Governance → Rollout
- All four new promotions visible in the Promotion Ledger viewer.
- Stabilization posture rendered amber on all four target tiers.

### Onboarding review
- Surface: Union Eyes → Pilot Governance
- Onboarding section rendered with phase-paced sequence.
- No acceleration exception present.

### Stabilization review
- Surface: Control Plane → Governance → Field Operations
- Four open continuity windows surfaced in Stabilization Guidance panel.
- Recommended posture: defer.

### Promotion review
- Authority reference visible per edge.
- CLI command surfaced as `pnpm rollout:promote:attest`.

### Rollback review
- Surface: Control Plane → Governance → Rollout · Rollback Posture
- Rollback recorded for pilot and visible.

### Environment review
- Surface: Control Plane → Governance → Field Operations · Lifecycle
- All five tiers rendered with derived state (provisioned / promoted / stabilizing).

### Cadence review
- Surface: Control Plane → Field Operations · Cadence
- All seven operator types rendered with current posture.
- No operator scorecard surfaced (refusal contract held).

---

## 3. Findings

| Finding category                | Observation                                           |
| ------------------------------- | ----------------------------------------------------- |
| Governance readability          | Authority links visible on every panel                |
| Stabilization comprehension     | "Stabilizing" terminology consistent across apps      |
| Continuity interpretation       | Continuity windows render minutes-remaining calmly    |
| Operational friction            | Single-screen panels; no drill-down required          |
| Refusal visibility              | Out-of-graph refusal surfaced as inline error in CLI  |
| Cadence affordances             | No "complete" buttons; cadence closes by attestation  |

---

## 4. Posture

The walkthrough cycle is the first operational cycle of the field
operations layer. It validates that the surfaces render real
posture from the real ledger and that the workflows close by
attestation rather than by manual marking.
