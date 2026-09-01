# Onboarding Stabilization Workflow

**Status:** Canonical Product 3 workflow. Operationalizes the [Onboarding Survivability Recovery](../playbooks/ONBOARDING_SURVIVABILITY_RECOVERY.md) playbook as a deterministic step sequence a composition engine can read.

**Audience:** Certified facilitators, governance bodies, composition engine implementers.

**Doctrine references:** [OCI_ONBOARDING_STABILIZATION.md](../OCI_ONBOARDING_STABILIZATION.md), [OCI_STABILIZATION_FRAMEWORK.md](../OCI_STABILIZATION_FRAMEWORK.md), [OCI_INTERVENTION_ETHICS.md](../OCI_INTERVENTION_ETHICS.md), [OCI_STABILIZATION_SEVERITY_MODEL.md](../OCI_STABILIZATION_SEVERITY_MODEL.md), [OCI_STABILIZATION_READINESS.md](../OCI_STABILIZATION_READINESS.md), [OCI_ACTION_SYSTEM.md](../OCI_ACTION_SYSTEM.md), [../../OCI_ANTI_SURVEILLANCE_POSITION.md](../../../OCI_ANTI_SURVEILLANCE_POSITION.md), [../../OCI_AI_BOUNDARY.md](../../../OCI_AI_BOUNDARY.md), [../../OCI_DATA_HANDLING.md](../../../OCI_DATA_HANDLING.md).

---

## 1. Purpose

Produce ratified onboarding records for roles whose succession would otherwise be unsupported, so that an incoming steward inherits a governance-receivable starting point rather than reconstructing the role from secondary sources.

## 2. Composed playbooks

- [Onboarding Survivability Recovery](../playbooks/ONBOARDING_SURVIVABILITY_RECOVERY.md)

## 3. Composed engines

- `onboardingFragilityAnalysis` — surfaces roles with critical onboarding fragility.
- `stabilizationPriorityEngine` — surfaces onboarding-critical role counts.
- `continuityRedistributionPlanner` (via `stewardshipRedistributionEngine`) — surfaces broadening candidates.

The workflow introduces no new analytics.

## 4. Severity gate

Offered at **Moderate** or above on the onboarding-fragility dimension. **Critical** readings require governance escalation recorded in the engagement log.

## 5. Readiness gate

All five [Readiness Thresholds](../OCI_STABILIZATION_READINESS.md) at sufficiency. Particular gates: **stewardship visibility**, **operational trust conditions**.

## 6. Step sequence

1. `onboard.scope_role` — fully reversible. Names the role and the continuity-bearing practice the record will hold.
2. `onboard.current_steward_walk` — fully reversible. The current steward walks the role in their language.
3. `onboard.record_draft` — reversible with cost. Draft is held with the current steward until release.
4. `onboard.incoming_review` — reversible with cost. The incoming or named candidate reads the draft.
5. `onboard.governance_ratification` — irreversible. The onboarding record becomes the institutional artefact under [OCI_ACTION_SYSTEM.md §3.4](../OCI_ACTION_SYSTEM.md).

## 7. Deferral semantics

Returned when:

- Severity below Moderate,
- Readiness insufficient,
- Current steward consent not present,
- No incoming candidate or named successor available.

Deferred workflows return a `note`-severity signal naming the missing condition.

## 8. Reciprocity terms

The current steward retains:

- Authorship attribution,
- Right to amend the record before ratification,
- Recognition as the institutional carrier of the role's continuity.

## 9. Persistence sketch (non-binding)

| Table | Columns (illustrative) |
|-------|------------------------|
| `oci_workflow_onboarding_stabilization` | `workflow_id`, `engagement_id`, `role_id`, `current_steward_id`, `incoming_candidate_id`, `severity_band`, `status`, `ratified_at` |
| `oci_workflow_step_log` | shared |

No migrations in the current sprint.
