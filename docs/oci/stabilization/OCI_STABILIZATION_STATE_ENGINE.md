# OCI Stabilization State Engine

**Status:** Canonical doctrine. Defines the institutional stabilization-state model and the deterministic state machine that governs progression through it. The state engine is the operational center of Product 3.

**Audience:** Certified facilitators, governance bodies, composition engine implementers.

**Doctrine references:** [OCI_STABILIZATION_FRAMEWORK.md](OCI_STABILIZATION_FRAMEWORK.md), [OCI_STABILIZATION_LIFECYCLE.md](OCI_STABILIZATION_LIFECYCLE.md), [OCI_STABILIZATION_SEVERITY_MODEL.md](OCI_STABILIZATION_SEVERITY_MODEL.md), [OCI_STABILIZATION_READINESS.md](OCI_STABILIZATION_READINESS.md), [OCI_ACTION_SYSTEM.md](OCI_ACTION_SYSTEM.md), [OCI_INTERVENTION_ETHICS.md](OCI_INTERVENTION_ETHICS.md), [../OCI_ANTI_SURVEILLANCE_POSITION.md](../OCI_ANTI_SURVEILLANCE_POSITION.md), [../OCI_AI_BOUNDARY.md](../OCI_AI_BOUNDARY.md), [../OCI_DATA_HANDLING.md](../OCI_DATA_HANDLING.md).

---

## 1. Purpose

The Stabilization State Engine is the canonical machine-readable expression of an institution's position in the Stabilization Lifecycle. It exists so that:

- An institution always holds a single, named stabilization state at any moment in an engagement,
- Progression from one state to the next is gated by explicit conditions (severity, readiness, ratification, consent),
- Regression is recognised as a legitimate, blame-free outcome,
- Composition engines can reason about which workflows, interventions, and reports are appropriate at a given state.

The state engine is not a scoring instrument. It does not rank institutions. It names institutional position.

## 2. The ten stabilization states

The state model uses ten ordinal states. The order expresses progression, not value. An institution that holds at a Recognition-only state for years is in good standing.

1. `recognition` — Institutional recognition has been re-confirmed for the stabilization engagement (Lifecycle Phase I exit met).
2. `mapping_complete` — A stabilization map has been returned to the institution and is held for ratification (Lifecycle Phase II exit met, ratification pending).
3. `continuity_debt_elevated` — One or more dimensions of [Continuity Debt](OCI_CONTINUITY_DEBT.md) are at elevated severity; the map has been ratified.
4. `stabilization_initiated` — The institution has ratified at least one stabilization move; the first move is under reversible execution.
5. `governance_recovery_active` — A governance clarification workflow is in active reversible execution; lineage is being recovered.
6. `stewardship_redistribution_active` — A stewardship redistribution workflow is in active reversible execution; reciprocity terms are ratified.
7. `onboarding_reinforcement_active` — An onboarding stabilization workflow is in active reversible execution.
8. `survivability_improving` — Severity readings show measured reduction across at least one Continuity Debt dimension while no dimension has regressed; institution is stabilising.
9. `continuity_stabilized` — All ratified stabilization moves have completed irreversible ratification; residual exposure landscape has been accepted by the governance body.
10. `longitudinal_monitoring` — The engagement has closed; the institution is receiving cadenced longitudinal readings (Product 5 forward link).

## 3. Transition contract

A transition is a typed event consisting of:

- A **current state**,
- A **target state**,
- The **gates** the transition requires (severity, readiness, reciprocity, consent, ratification),
- A **deferral disposition** when gates are not met (defer, hold, regress).

Transitions are not assertions. A transition is **proposed** by the state engine and **ratified** by the facilitator with the governance body. The state machine refuses illegal transitions.

## 4. Legal transitions

The transition graph is intentionally narrow. Forward transitions follow the lifecycle order with two intentional rules:

1. **Multi-workflow concurrency:** From `stabilization_initiated`, the institution may enter any of the three workflow-active states (`governance_recovery_active`, `stewardship_redistribution_active`, `onboarding_reinforcement_active`) and may hold more than one concurrently. The state engine resolves concurrent holds by reporting the most recent active state with the full active-state set as evidence.
2. **Convergent improvement:** Any of the three workflow-active states may transition to `survivability_improving` once measured improvement is present without regression.

Backward transitions are permitted only as:

- **Regression to elevated** from any workflow-active state when severity worsens on the relevant dimension (recorded as institutional record, not as fault),
- **Regression to mapping_complete** when the governance body withdraws ratification,
- **Regression to recognition** when institutional consent is withdrawn from the engagement.

Skipping a state is permitted only along the documented adjacency edges. Arbitrary long-jump transitions are refused.

## 5. Gates per transition

Every forward transition carries gates. A transition with unmet gates is **deferred**, not refused. Deferral is a method outcome.

| From | To | Required gates |
|------|----|----------------|
| `recognition` | `mapping_complete` | Phase II map returned; readiness reverified |
| `mapping_complete` | `continuity_debt_elevated` | Governance ratification of map; severity ≥ Elevated on at least one dimension |
| `continuity_debt_elevated` | `stabilization_initiated` | At least one stabilization move ratified; reversibility documented |
| `stabilization_initiated` | `governance_recovery_active` | Governance clarification workflow eligibility + readiness |
| `stabilization_initiated` | `stewardship_redistribution_active` | Reciprocity terms ratified; redistribution workflow eligibility |
| `stabilization_initiated` | `onboarding_reinforcement_active` | Onboarding stabilization workflow eligibility |
| any workflow-active | `survivability_improving` | Measured reduction without regression on any dimension |
| `survivability_improving` | `continuity_stabilized` | All ratified moves at irreversible ratification; governance acceptance of residual |
| `continuity_stabilized` | `longitudinal_monitoring` | Engagement closure action ratified |

## 6. Concurrency and active-state evidence

The state engine carries the institution's **single declared state** and an **active-state set** for the three workflow-active concurrent states. The declared state is the most recently entered. The active-state set is the union of currently active workflow states. The declared state is what reports surface; the active-state set is what facilitators read.

## 7. Regression handling

Regression is recognised, not penalised. A regression event carries:

- The state regressed from,
- The state regressed to,
- The institutional condition that triggered regression (severity worsening, consent withdrawal, ratification withdrawal),
- The reciprocity terms preserved through the regression.

A regression is recorded in the engagement log and is offered to the governance body as institutional record. No regression is offered to the institution as fault.

## 8. What the state engine does not do

The state engine:

- Does not act on the institution's behalf,
- Does not advance state without governance ratification at every irreversible transition,
- Does not produce numeric scores,
- Does not produce comparative rankings,
- Does not carry person-level data,
- Does not persist to a database in the current sprint.

## 9. Persistence sketch (non-binding)

| Table | Columns (illustrative) |
|-------|------------------------|
| `oci_stabilization_state` | `engagement_id`, `declared_state`, `active_state_set`, `entered_at`, `entered_by_governance_action_id` |
| `oci_stabilization_state_transition_log` | `transition_id`, `engagement_id`, `from_state`, `to_state`, `gates_met`, `gates_deferred`, `proposed_at`, `ratified_at`, `regression_reason` |

Schema is illustrative. No tables are created in the current sprint. See [OCI_ACTION_SYSTEM.md §5](OCI_ACTION_SYSTEM.md) for the canonical persistence-sketch posture.

## 10. Relation to workflows

The state engine and the workflow engine are siblings. The state engine names institutional position. The workflow engine names which workflows are appropriate at that position. See [docs/oci/stabilization/workflows/README.md](workflows/README.md) and [`stabilizationWorkflowEngine.ts`](../../apps/union-eyes/lib/workbook/engines/workflows/stabilizationWorkflowEngine.ts).
