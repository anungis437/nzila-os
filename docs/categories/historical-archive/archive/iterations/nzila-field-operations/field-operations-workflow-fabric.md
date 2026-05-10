# Field Operations Workflow Fabric

**Status:** Active
**Effective:** 2026-05-09
**Authority:** [master-field-operations-index.md](./master-field-operations-index.md)

This document defines the canonical institutional operational
workflows for Nzila field operations.

---

## 1. Posture

Workflows are **governance-guided**, not process-heavy. A workflow
is a small set of governed steps with named authority. It is not a
ticketing system.

---

## 2. Canonical workflows

| Workflow              | Authority document                                        |
| --------------------- | --------------------------------------------------------- |
| Pilot prep            | pilot-execution-discipline.md                             |
| Rollout prep          | nzila-rollout-governance/operational-rollout-workflows.md |
| Onboarding prep       | onboarding-governance-operations.md                       |
| Governance review     | governance-review-cadence.md                              |
| Stabilization review  | stabilization-operations-system.md                        |
| Executive review      | executive-briefing-rhythm.md                              |
| Environment review    | environment-lifecycle-governance.md                       |
| Promotion review      | nzila-rollout-governance/operational-rollout-workflows.md |
| Rollback review       | nzila-rollout-governance/operational-rollout-workflows.md |

---

## 3. Workflow anatomy

Every workflow has:

- **Trigger** — what opens the workflow.
- **Steps** — typically 3–6 governed steps.
- **Authority** — the doc that defines the steps.
- **Closing artifact** — an attestation or interpretive note.

Workflows do not branch into sub-workflows. Branching is a sign of
process bureaucracy and is refused at the doctrine level.

---

## 4. Surfaces

Workflows are rendered as workflow panels in:

- Control Plane → Governance → Field Operations
- Console → Field Operations Briefing
- Union Eyes → Pilot Governance

Each workflow panel surfaces the trigger, the open step, and the
authority link. It does not implement state machines beyond what
the recorded attestations reveal.

---

## 5. Operational sequencing summaries

The Field Operations dashboard renders an operational sequencing
summary — a single calm view of which workflows are open across the
ecosystem.

---

## 6. Governance-linked transitions

Workflow step transitions are governance-linked: a step closes when
its expected attestation appears in the ledger. There is no manual
"mark complete" affordance.

---

## 7. Posture

The workflow fabric is light. It is meant to make institutional
operations legible, not to manage them.
