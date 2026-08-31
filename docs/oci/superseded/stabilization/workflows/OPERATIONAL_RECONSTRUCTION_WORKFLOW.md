# Operational Reconstruction Workflow

**Status:** Canonical Product 3 workflow. Operationalizes the [Operational Reconstruction Recovery](../playbooks/OPERATIONAL_RECONSTRUCTION_RECOVERY.md) playbook as a deterministic step sequence a composition engine can read.

**Audience:** Certified facilitators, governance bodies, composition engine implementers.

**Doctrine references:** [OCI_STABILIZATION_FRAMEWORK.md](../OCI_STABILIZATION_FRAMEWORK.md), [OCI_INTERVENTION_ETHICS.md](../OCI_INTERVENTION_ETHICS.md), [OCI_STABILIZATION_SEVERITY_MODEL.md](../OCI_STABILIZATION_SEVERITY_MODEL.md), [OCI_STABILIZATION_READINESS.md](../OCI_STABILIZATION_READINESS.md), [OCI_ACTION_SYSTEM.md](../OCI_ACTION_SYSTEM.md), [../../OCI_ANTI_SURVEILLANCE_POSITION.md](../../../OCI_ANTI_SURVEILLANCE_POSITION.md), [../../OCI_AI_BOUNDARY.md](../../../OCI_AI_BOUNDARY.md), [../../OCI_DATA_HANDLING.md](../../../OCI_DATA_HANDLING.md).

---

## 1. Purpose

Recover lapsed institutional practice through secondary sources and adjacent stewards, with explicit `recovered`, `reconstructed`, and `unresolved` markings, so the institution holds an honest reading of what it has and what it does not.

## 2. Composed playbooks

- [Operational Reconstruction Recovery](../playbooks/OPERATIONAL_RECONSTRUCTION_RECOVERY.md)

## 3. Composed engines

- `reconstructionBurdenAnalyzer` — surfaces reconstruction burden severity and adjacent-steward availability.
- `continuityLineageEngine` — surfaces lapsed precedents and lineage gaps.
- `continuityBreakpointEngine` — surfaces operational breakpoints requiring recovery.
- `continuityCollapsePredictor` — surfaces collapse trajectories where reconstruction is overdue.

The workflow introduces no new analytics.

## 4. Severity gate

Offered at **Elevated** or above on the reconstruction-burden dimension. **Institutional Fragility** readings require governance escalation and a recorded acceptance of the residual unresolved surface.

## 5. Readiness gate

All five [Readiness Thresholds](../OCI_STABILIZATION_READINESS.md) at sufficiency. Particular gates: **governance ratification posture**, **historical-tenure recognition**, **operational trust conditions**.

## 6. Step sequence

1. `reconstruct.scope_lapsed_practice` — fully reversible. Names the lapsed practice and adjacent stewards.
2. `reconstruct.secondary_source_review` — fully reversible. Reads records, precedents, adjacent practice without asserting recovery.
3. `reconstruct.adjacent_steward_consult` — reversible with cost. Adjacent stewards consulted; their recognition is honoured.
4. `reconstruct.honest_marking` — reversible with cost. Each item is explicitly marked `recovered`, `reconstructed`, or `unresolved`. No fabrication.
5. `reconstruct.governance_ratification` — irreversible. The marked record is ratified, including the unresolved residual, under [OCI_ACTION_SYSTEM.md §3.6](../OCI_ACTION_SYSTEM.md).

## 7. Deferral semantics

Returned when:

- Severity below Elevated,
- Readiness insufficient,
- No adjacent stewards available,
- Governance unwilling to accept an unresolved residual.

Deferral is honest and is a method outcome.

## 8. Reciprocity terms

Adjacent stewards consulted retain:

- Recognition for their contribution to recovery,
- Authorship attribution on items marked `reconstructed` from their input,
- Recorded acknowledgement in the engagement log.

The institution accepts that `unresolved` items remain unresolved and that no fabrication will be offered to close the residual.

## 9. Persistence sketch (non-binding)

| Table | Columns (illustrative) |
|-------|------------------------|
| `oci_workflow_operational_reconstruction` | `workflow_id`, `engagement_id`, `lapsed_practice`, `adjacent_steward_ids`, `recovered_count`, `reconstructed_count`, `unresolved_count`, `severity_band`, `status`, `ratified_at` |
| `oci_workflow_step_log` | shared |

No migrations in the current sprint.
