# Governance Clarification Workflow

**Status:** Canonical Product 3 workflow. Operationalizes the [Governance Lineage Recovery](../playbooks/GOVERNANCE_LINEAGE_RECOVERY.md) playbook as a deterministic step sequence a composition engine can read.

**Audience:** Certified facilitators, governance bodies, composition engine implementers.

**Doctrine references:** [OCI_STABILIZATION_FRAMEWORK.md](../OCI_STABILIZATION_FRAMEWORK.md), [OCI_INTERVENTION_ETHICS.md](../OCI_INTERVENTION_ETHICS.md), [GOVERNANCE_SURVIVABILITY_RECOVERY.md](../GOVERNANCE_SURVIVABILITY_RECOVERY.md), [OCI_STABILIZATION_SEVERITY_MODEL.md](../OCI_STABILIZATION_SEVERITY_MODEL.md), [OCI_STABILIZATION_READINESS.md](../OCI_STABILIZATION_READINESS.md), [OCI_ACTION_SYSTEM.md](../OCI_ACTION_SYSTEM.md), [../../OCI_ANTI_SURVEILLANCE_POSITION.md](../../OCI_ANTI_SURVEILLANCE_POSITION.md), [../../OCI_AI_BOUNDARY.md](../../OCI_AI_BOUNDARY.md), [../../OCI_DATA_HANDLING.md](../../OCI_DATA_HANDLING.md).

---

## 1. Purpose

Recover and return institutional interpretation, precedent, and governance reasoning that has lapsed, faded, or drifted, in a form the governance body can ratify without attributing fault to historical tenure.

## 2. Composed playbooks

- [Governance Lineage Recovery](../playbooks/GOVERNANCE_LINEAGE_RECOVERY.md)

## 3. Composed engines

- `continuityLineageEngine` (via `governanceRecoveryEngine`) — surfaces precedents, interpretation matrix, survivability bands.
- `governanceEntropyEngine` — surfaces design-practice drift readings.
- `precedentContinuityMapper` (indirect via lineage engine) — surfaces precedent continuity bands.

The workflow introduces no new analytics. It reads existing signals only.

## 4. Severity gate

Offered when governance drift, lapsed precedent count, or interpretation drift is at **Moderate** or above. **Critical**-band readings escalate to a recorded governance decision before the workflow is run.

## 5. Readiness gate

All five [Readiness Thresholds](../OCI_STABILIZATION_READINESS.md) at sufficiency. Particular gates: **governance ratification posture**, **historical-tenure recognition**.

## 6. Step sequence

1. `clarify.lineage_surface` — fully reversible. Reads `governanceRecoveryEngine.lineage.precedents` and `lineage.interpretationMatrix`.
2. `clarify.tenure_recognition` — fully reversible. The workflow refuses to proceed without explicit recognition of the historical tenure whose interpretation is being recovered.
3. `clarify.interpretation_matrix_return` — reversible with cost. The recovered matrix is offered to the governance body for review, not asserted.
4. `clarify.drift_naming` — reversible with cost. Named drift is documented as institutional record, not as personal critique.
5. `clarify.governance_ratification` — irreversible. The governance body ratifies the recovered material under [OCI_ACTION_SYSTEM.md §3.7](../OCI_ACTION_SYSTEM.md).

## 7. Deferral semantics

Returned when:

- Severity below Moderate on governance dimensions,
- Readiness conditions insufficient,
- Historical tenure recognition refused,
- Governance body unavailable for ratification cadence.

Deferred workflow returns a `note`-severity signal naming the missing condition.

## 8. Reciprocity terms

The historical-tenure stewards whose interpretation is being recovered retain:

- Recognition as the institutional carriers of the recovered interpretation,
- Right of review of the matrix before ratification where they remain available,
- Recorded acknowledgement in the engagement log where they do not.

## 9. Persistence sketch (non-binding)

| Table | Columns (illustrative) |
|-------|------------------------|
| `oci_workflow_governance_clarification` | `workflow_id`, `engagement_id`, `severity_band`, `precedent_count`, `interpretation_drift_aggregate`, `status`, `ratified_at` |
| `oci_workflow_step_log` | shared with other workflows |

No migrations in the current sprint.
