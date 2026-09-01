# Stewardship Redistribution Workflow

**Status:** Canonical Product 3 workflow. Operationalizes the [Stewardship Redistribution](../playbooks/STEWARDSHIP_REDISTRIBUTION.md) playbook and integrates with the [Leadership Transition Stabilization](../playbooks/LEADERSHIP_TRANSITION_STABILIZATION.md) playbook as a deterministic step sequence a composition engine can read.

**Audience:** Certified facilitators, governance bodies, composition engine implementers.

**Doctrine references:** [STEWARDSHIP_REDISTRIBUTION.md](../STEWARDSHIP_REDISTRIBUTION.md), [OCI_STABILIZATION_FRAMEWORK.md](../OCI_STABILIZATION_FRAMEWORK.md), [OCI_INTERVENTION_ETHICS.md](../OCI_INTERVENTION_ETHICS.md), [OCI_STABILIZATION_SEVERITY_MODEL.md](../OCI_STABILIZATION_SEVERITY_MODEL.md), [OCI_STABILIZATION_READINESS.md](../OCI_STABILIZATION_READINESS.md), [OCI_ACTION_SYSTEM.md](../OCI_ACTION_SYSTEM.md), [../../OCI_ANTI_SURVEILLANCE_POSITION.md](../../../OCI_ANTI_SURVEILLANCE_POSITION.md), [../../OCI_AI_BOUNDARY.md](../../../OCI_AI_BOUNDARY.md), [../../OCI_DATA_HANDLING.md](../../../OCI_DATA_HANDLING.md).

---

## 1. Purpose

Broaden the set of stewards carrying a continuity-bearing practice with explicit reciprocity terms for the originating steward, without positioning the originating steward as a bottleneck and without disturbing recognition standing.

## 2. Composed playbooks

- [Stewardship Redistribution](../playbooks/STEWARDSHIP_REDISTRIBUTION.md)
- [Leadership Transition Stabilization](../playbooks/LEADERSHIP_TRANSITION_STABILIZATION.md)

## 3. Composed engines

- `continuityRedistributionPlanner` (via `stewardshipRedistributionEngine`) — surfaces redistribution targets and reciprocity gates.
- `stabilizationPriorityEngine` — surfaces single-carrier process counts.
- `continuityDependencyGraph` — surfaces dependency concentration.

The workflow introduces no new analytics.

## 4. Severity gate

Offered at **Elevated** or above on the steward-concentration dimension. **Institutional Fragility** readings require explicit governance decision recorded in the engagement log.

## 5. Readiness gate

All five [Readiness Thresholds](../OCI_STABILIZATION_READINESS.md) at sufficiency. **Reciprocity terms ratified** is a hard gate; the workflow is held in deferral until ratification.

## 6. Step sequence

1. `redistribute.recognition_reaffirmation` — fully reversible. The originating steward's recognition standing is restated before any redistribution offer.
2. `redistribute.reciprocity_terms_naming` — fully reversible. Named, written reciprocity terms (recognition, standing, scope, reversal path).
3. `redistribute.candidate_naming` — reversible with cost. Carrier-broadening candidate(s) named.
4. `redistribute.consent_capture` — reversible with cost. Steward and candidate consent captured per [OCI_INTERVENTION_ETHICS.md](../OCI_INTERVENTION_ETHICS.md).
5. `redistribute.practice_transfer` — reversible with cost. Joint walk-throughs; the originating steward leads.
6. `redistribute.governance_ratification` — irreversible. The broadened arrangement is ratified under [OCI_ACTION_SYSTEM.md §3.3](../OCI_ACTION_SYSTEM.md).

## 7. Deferral semantics

Returned when:

- Reciprocity terms not ratified,
- Originating steward consent not present,
- Severity below Elevated,
- Readiness insufficient,
- No redistribution targets named.

Deferral is a method outcome and is recorded in the engagement log.

## 8. Reciprocity terms

The originating steward retains:

- Recognition standing as the continuity carrier of the practice,
- Authorship attribution on captured records,
- The right to halt redistribution at any reversible step,
- Recorded recognition of the institutional contribution the practice represents.

## 9. Persistence sketch (non-binding)

| Table | Columns (illustrative) |
|-------|------------------------|
| `oci_workflow_stewardship_redistribution` | `workflow_id`, `engagement_id`, `originating_steward_id`, `candidate_ids`, `reciprocity_terms_ratified_at`, `severity_band`, `status` |
| `oci_workflow_step_log` | shared |

No migrations in the current sprint.
