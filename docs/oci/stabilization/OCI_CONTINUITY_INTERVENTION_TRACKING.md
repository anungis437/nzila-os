# OCI Continuity Intervention Tracking

**Status:** Canonical doctrine. Defines the per-intervention lifecycle, the intervention ledger structure, and the deterministic tracking engine that reads them.

**Audience:** Certified facilitators, governance bodies, composition engine implementers.

**Doctrine references:** [OCI_STABILIZATION_STATE_ENGINE.md](OCI_STABILIZATION_STATE_ENGINE.md), [OCI_STABILIZATION_LIFECYCLE.md](OCI_STABILIZATION_LIFECYCLE.md), [OCI_ACTION_SYSTEM.md](OCI_ACTION_SYSTEM.md), [OCI_INTERVENTION_ETHICS.md](OCI_INTERVENTION_ETHICS.md), [workflows/STEWARDSHIP_REDISTRIBUTION_WORKFLOW.md](workflows/STEWARDSHIP_REDISTRIBUTION_WORKFLOW.md), [../OCI_DATA_HANDLING.md](../OCI_DATA_HANDLING.md), [../OCI_AI_BOUNDARY.md](../OCI_AI_BOUNDARY.md).

---

## 1. Purpose

The Stabilization State Engine names institutional position. The Workflow Engine names which workflows are appropriate at that position. Continuity Intervention Tracking names the lifecycle of each individual move ratified inside a workflow.

A continuity intervention is the smallest unit of stabilization action carried by an OCI engagement. Examples:

- Re-anchor a lapsed compensation precedent,
- Redistribute a single concentrated stewardship process,
- Resequence an onboarding stabilization plan for a named role,
- Reverse-engineer a modernization step that bypassed lineage.

Each intervention progresses through its own lifecycle and must be tracked independently. The tracking engine reads the ledger of interventions and emits signals naming where the institution stands per intervention — not per person.

## 2. The seven intervention statuses

1. `proposed` — Surfaced by an engine or facilitator; not yet ratified by the governance body.
2. `ratified` — Ratified by the governance body; reversibility window not yet open.
3. `in_reversible_execution` — Reversibility window is open; the intervention is being carried out and may be wound back with no institutional fault.
4. `awaiting_irreversible_ratification` — The reversibility window has closed; the governance body must explicitly affirm or wind back.
5. `irreversibly_ratified` — Affirmed past the reversibility window; the intervention has become institutional record.
6. `regressed` — Wound back during or after execution; recorded as institutional record, never as fault.
7. `withdrawn` — Withdrawn before any execution; no institutional record beyond the proposal itself.

`irreversibly_ratified` and `regressed` and `withdrawn` are terminal statuses. The intervention does not re-enter the active lifecycle from a terminal status; a new intervention is proposed instead.

## 3. Lifecycle transition contract

A status change is an event that carries:

- The intervention `id`,
- The prior `status`,
- The new `status`,
- The institutional action that produced the change (`proposed_by_engine` | `ratified_by_governance` | `reversibility_window_opened` | `reversibility_window_closed` | `irreversibly_ratified_by_governance` | `regressed_by_governance` | `withdrawn_by_governance`),
- The timestamp of the action (in the engagement clock, not wall-clock person tracking).

Status events are append-only. The ledger is the ordered list of events plus a derived current-status map per intervention id.

## 4. Legal lifecycle transitions

| From | To | Producing action |
|------|----|------------------|
| `proposed` | `ratified` | `ratified_by_governance` |
| `proposed` | `withdrawn` | `withdrawn_by_governance` |
| `ratified` | `in_reversible_execution` | `reversibility_window_opened` |
| `ratified` | `withdrawn` | `withdrawn_by_governance` |
| `in_reversible_execution` | `awaiting_irreversible_ratification` | `reversibility_window_closed` |
| `in_reversible_execution` | `regressed` | `regressed_by_governance` |
| `awaiting_irreversible_ratification` | `irreversibly_ratified` | `irreversibly_ratified_by_governance` |
| `awaiting_irreversible_ratification` | `regressed` | `regressed_by_governance` |

No other transitions are legal. A jump from `proposed` to `irreversibly_ratified` is refused. Reversibility must always be honoured.

## 5. The ledger

The intervention ledger holds, for an engagement:

- The full append-only **event list**,
- The derived **current status** per intervention id,
- The derived **set of interventions in active lifecycle** (statuses 1–4),
- The derived **set of interventions in terminal lifecycle** (statuses 5–7).

The ledger is a value object. The tracking engine recomputes derived state from the event list deterministically. No DB writes in the current sprint; the ledger is held in-memory during a facilitator session.

## 6. What the tracking engine emits

Given an intervention ledger and a current stabilization state, the tracking engine emits canonical signal envelopes naming:

- Interventions **awaiting ratification** longer than a configured engagement-clock threshold,
- Interventions **in reversibility window** approaching its close,
- Interventions **awaiting irreversible ratification** that have not been acted on,
- Interventions that **regressed without a recorded recovery action**,
- The **active-intervention count** by workflow,
- The **terminal-intervention distribution** (irreversibly_ratified / regressed / withdrawn) for institutional record.

The tracking engine does not score, rank, or compare. It names institutional position per intervention.

## 7. Relationship to the state engine

The tracking engine reads the stabilization state declared by the [State Engine](OCI_STABILIZATION_STATE_ENGINE.md). When the declared state is at a workflow-active state, the tracking engine surfaces interventions belonging to that workflow with higher visibility. When the declared state is `survivability_improving`, the tracking engine surfaces interventions awaiting irreversible ratification with higher visibility (because consolidation is the work of that phase).

The tracking engine never changes the declared state. It only names what is true about active interventions.

## 8. Persistence sketch (non-binding)

| Table | Columns (illustrative) |
|-------|------------------------|
| `oci_intervention` | `intervention_id`, `engagement_id`, `workflow_key`, `subject_summary`, `proposed_at`, `current_status`, `current_status_action_id` |
| `oci_intervention_event` | `event_id`, `intervention_id`, `from_status`, `to_status`, `producing_action`, `recorded_at` |

Schema is illustrative. No tables are created in the current sprint.

## 9. What the tracking engine does not do

- Does not carry person-level data,
- Does not track per-person execution,
- Does not produce numeric scores or rankings,
- Does not advance an intervention's status without a producing governance action,
- Does not communicate to the institution; it surfaces to the facilitator and the governance body.
