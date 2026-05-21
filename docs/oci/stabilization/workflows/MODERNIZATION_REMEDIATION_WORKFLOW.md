# Modernization Remediation Workflow

**Status:** Canonical Product 3 workflow. Operationalizes the [Modernization Continuity Remediation](../playbooks/MODERNIZATION_CONTINUITY_REMEDIATION.md) playbook as a deterministic step sequence a composition engine can read.

**Audience:** Certified facilitators, governance bodies, composition engine implementers.

**Doctrine references:** [OCI_STABILIZATION_FRAMEWORK.md](../OCI_STABILIZATION_FRAMEWORK.md), [OCI_INTERVENTION_ETHICS.md](../OCI_INTERVENTION_ETHICS.md), [OCI_STABILIZATION_SEVERITY_MODEL.md](../OCI_STABILIZATION_SEVERITY_MODEL.md), [OCI_STABILIZATION_READINESS.md](../OCI_STABILIZATION_READINESS.md), [OCI_ACTION_SYSTEM.md](../OCI_ACTION_SYSTEM.md), [../../OCI_ANTI_SURVEILLANCE_POSITION.md](../../OCI_ANTI_SURVEILLANCE_POSITION.md), [../../OCI_AI_BOUNDARY.md](../../OCI_AI_BOUNDARY.md), [../../OCI_DATA_HANDLING.md](../../OCI_DATA_HANDLING.md).

---

## 1. Purpose

Record the institutional interpretation embedded in a practice that a modernization is about to replace, so that substitution proceeds without lapsing the interpretation the practice carried.

## 2. Composed playbooks

- [Modernization Continuity Remediation](../playbooks/MODERNIZATION_CONTINUITY_REMEDIATION.md)

## 3. Composed engines

- `modernizationAlignmentEngine` — surfaces alignment readings between modernization scope and continuity-bearing practice.
- `governanceModernizationReview` — surfaces governance posture toward the modernization.
- `continuitySafeModernization` — surfaces continuity-safety gates.
- `continuityLineageEngine` — surfaces lineage at risk of lapse through substitution.

The workflow introduces no new analytics.

## 4. Severity gate

Offered at **Moderate** or above on the modernization-without-preservation dimension. **Critical** readings require recorded governance decision before substitution proceeds.

## 5. Readiness gate

All five [Readiness Thresholds](../OCI_STABILIZATION_READINESS.md) at sufficiency. Particular gates: **governance ratification posture**, **historical-tenure recognition** for the practice being replaced.

## 6. Step sequence

1. `modernize.scope_substitution` — fully reversible. Names what the modernization is replacing and what continuity-bearing interpretation the replaced practice carries.
2. `modernize.interpretation_capture` — fully reversible. The interpretation is captured before substitution.
3. `modernize.preservation_assessment` — reversible with cost. The modernization is reviewed against the captured interpretation; preservation gaps are named.
4. `modernize.remediation_design` — reversible with cost. Where preservation gaps exist, remediation is designed before substitution proceeds.
5. `modernize.governance_ratification` — irreversible. Substitution proceeds only after governance ratifies preservation under [OCI_ACTION_SYSTEM.md §3.5](../OCI_ACTION_SYSTEM.md).

## 7. Deferral semantics

Returned when:

- Severity below Moderate,
- Readiness insufficient,
- Modernization scope not named,
- Interpretation capture refused or incomplete.

Deferral halts substitution until conditions are met.

## 8. Reciprocity terms

The stewards whose practice is being substituted retain:

- Authorship attribution on the captured interpretation,
- Recognition as the institutional carriers of the replaced practice,
- The right to halt substitution at any reversible step before ratification.

## 9. Persistence sketch (non-binding)

| Table | Columns (illustrative) |
|-------|------------------------|
| `oci_workflow_modernization_remediation` | `workflow_id`, `engagement_id`, `substitution_scope`, `interpretation_captured_at`, `preservation_gaps`, `severity_band`, `status`, `ratified_at` |
| `oci_workflow_step_log` | shared |

No migrations in the current sprint.
