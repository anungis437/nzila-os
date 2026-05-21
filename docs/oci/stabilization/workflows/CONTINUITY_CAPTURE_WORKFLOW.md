# Continuity Capture Workflow

**Status:** Canonical Product 3 workflow. Operationalizes the [Continuity Capture Sprint](../playbooks/CONTINUITY_CAPTURE_SPRINT.md) playbook as a deterministic step sequence a composition engine can read.

**Audience:** Certified facilitators, governance bodies, composition engine implementers.

**Doctrine references:** [OCI_STABILIZATION_FRAMEWORK.md](../OCI_STABILIZATION_FRAMEWORK.md), [OCI_INTERVENTION_ETHICS.md](../OCI_INTERVENTION_ETHICS.md), [OCI_STABILIZATION_SEVERITY_MODEL.md](../OCI_STABILIZATION_SEVERITY_MODEL.md), [OCI_STABILIZATION_READINESS.md](../OCI_STABILIZATION_READINESS.md), [OCI_ACTION_SYSTEM.md](../OCI_ACTION_SYSTEM.md), [../../OCI_ANTI_SURVEILLANCE_POSITION.md](../../OCI_ANTI_SURVEILLANCE_POSITION.md), [../../OCI_AI_BOUNDARY.md](../../OCI_AI_BOUNDARY.md), [../../OCI_DATA_HANDLING.md](../../OCI_DATA_HANDLING.md).

---

## 1. Purpose

Convert undocumented continuity-bearing practice into a governance-receivable record while the carrying steward is still present, without positioning the steward as a bottleneck.

## 2. Composed playbooks

- [Continuity Capture Sprint](../playbooks/CONTINUITY_CAPTURE_SPRINT.md)

## 3. Composed engines

- `stabilizationPriorityEngine` — surfaces undocumented single-carrier process counts.
- `continuityRedistributionPlanner` (via `stewardshipRedistributionEngine`) — surfaces lineage capture targets.
- `onboardingFragilityAnalysis` — surfaces roles where capture would prevent succession collapse.

The workflow introduces no new analytics. It reads existing signals only.

## 4. Severity gate

The workflow may be offered when severity readings on the undocumented-process or steward-concentration dimension are at **Elevated** or above. Sprints at **Critical** or **Institutional Fragility** require an explicit governance decision recorded in the engagement log.

## 5. Readiness gate

All five [Readiness Thresholds](../OCI_STABILIZATION_READINESS.md) at sufficiency. Particular gates: **stewardship visibility**, **operational trust conditions**, **governance ratification posture**.

## 6. Step sequence

Each step carries a `stepId`, an ordered position, a reversibility profile, and the engine signal(s) it consumes.

1. `capture.scope_with_steward` — fully reversible. Consumes redistribution lineage gap signal.
2. `capture.practice_walkthrough` — fully reversible. Consumes priority engine undocumented-process signal.
3. `capture.written_draft` — reversible with cost. The draft is the steward's property until released.
4. `capture.candidate_review` — reversible with cost. The carrier-broadening candidate reviews with the steward.
5. `capture.governance_ratification` — irreversible. The record becomes institutional property under [OCI_ACTION_SYSTEM.md §3.7](../OCI_ACTION_SYSTEM.md).

## 7. Deferral semantics

Returned when:

- Severity below Elevated on relevant dimensions,
- Readiness conditions insufficient,
- Steward consent not present,
- Carrier-broadening candidate not named.

A deferred workflow returns a `note`-severity signal naming the missing condition. Deferral is a method outcome.

## 8. Reciprocity terms

The originating steward retains:

- Authorship attribution on the captured record,
- Recognition standing as the institution's continuity carrier for the captured practice,
- The right to amend the record before ratification.

The institution commits to honouring these terms before the workflow is offered.

## 9. Persistence sketch (non-binding)

Candidate tables for a future runtime build. Not a migration. Not implemented in this sprint.

| Table | Columns (illustrative) |
|-------|------------------------|
| `oci_workflow_continuity_capture` | `workflow_id`, `engagement_id`, `subject_practice`, `originating_steward_id`, `candidate_id`, `severity_band`, `status`, `ratified_at` |
| `oci_workflow_step_log` | `step_id`, `workflow_id`, `step_key`, `reversibility`, `consent_captured_at`, `deferred_reason` |

Schema is illustrative. No tables are created in the current sprint. See [OCI_ACTION_SYSTEM.md §5](../OCI_ACTION_SYSTEM.md) for the canonical persistence-sketch posture.
