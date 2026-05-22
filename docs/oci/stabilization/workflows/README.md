# OCI Stabilization Workflows

**Status:** Canonical index for the six executable stabilization workflows. A workflow is the operational, sequenced shape of a stabilization intervention. Workflows are how the seven [playbooks](../playbooks/README.md) become executable composition: a playbook is a facilitator document, a workflow is the deterministic sequencing contract that a composition engine can read and offer.

**Audience:** Certified facilitators preparing engagement sequencing, governance bodies reviewing the operational shape of a stabilization engagement, platform engineers composing stabilization runtime over existing OCI engines.

**Doctrine references:**

- [OCI_STABILIZATION_FRAMEWORK.md](../OCI_STABILIZATION_FRAMEWORK.md)
- [OCI_INTERVENTION_MODEL.md](../OCI_INTERVENTION_MODEL.md)
- [OCI_INTERVENTION_ETHICS.md](../OCI_INTERVENTION_ETHICS.md)
- [OCI_STABILIZATION_LIFECYCLE.md](../OCI_STABILIZATION_LIFECYCLE.md)
- [OCI_STABILIZATION_SEVERITY_MODEL.md](../OCI_STABILIZATION_SEVERITY_MODEL.md)
- [OCI_STABILIZATION_READINESS.md](../OCI_STABILIZATION_READINESS.md)
- [OCI_ACTION_SYSTEM.md](../OCI_ACTION_SYSTEM.md)
- [../../OCI_ANTI_SURVEILLANCE_POSITION.md](../../OCI_ANTI_SURVEILLANCE_POSITION.md)
- [../../OCI_AI_BOUNDARY.md](../../OCI_AI_BOUNDARY.md)
- [../../OCI_DATA_HANDLING.md](../../OCI_DATA_HANDLING.md)

---

## 1. Workflow vs playbook

A **playbook** is a facilitator-readable document describing how a stabilization shape is run with a governance body.

A **workflow** is the executable composition layer for that playbook. It exposes:

- An ordered sequence of **steps** each composition engine can read,
- The **engines** whose signals inform each step,
- The **severity band gates** that allow a step to be offered,
- The **readiness conditions** each step requires,
- The **deferral semantics** when conditions are not met,
- The **reciprocity terms** the workflow carries forward,
- The **non-binding persistence sketch** mirroring [OCI_ACTION_SYSTEM.md §5](../OCI_ACTION_SYSTEM.md).

A workflow does not execute autonomously. It is the deterministic shape a facilitator follows; a composition engine reads it to recommend a sequenced offer.

## 2. The six workflows

| # | Workflow | Primary playbook(s) | Severity bands |
|---|----------|--------------------|----------------|
| 1 | [Continuity Capture](CONTINUITY_CAPTURE_WORKFLOW.md) | Continuity Capture Sprint | Elevated → Critical |
| 2 | [Governance Clarification](GOVERNANCE_CLARIFICATION_WORKFLOW.md) | Governance Lineage Recovery | Moderate → Critical |
| 3 | [Stewardship Redistribution](STEWARDSHIP_REDISTRIBUTION_WORKFLOW.md) | Stewardship Redistribution + Leadership Transition Stabilization | Elevated → Institutional Fragility |
| 4 | [Onboarding Stabilization](ONBOARDING_STABILIZATION_WORKFLOW.md) | Onboarding Survivability Recovery | Moderate → Critical |
| 5 | [Modernization Remediation](MODERNIZATION_REMEDIATION_WORKFLOW.md) | Modernization Continuity Remediation | Moderate → Critical |
| 6 | [Operational Reconstruction](OPERATIONAL_RECONSTRUCTION_WORKFLOW.md) | Operational Reconstruction Recovery | Elevated → Institutional Fragility |

The six workflows cover the operational surface of Product 3. There is intentionally no seventh workflow; the seventh playbook (Leadership Transition Stabilization) composes Workflows 1, 3, and 4 rather than carrying a separate sequencing contract.

## 3. Common workflow template

Every workflow document follows the same nine-section template:

1. **Purpose** — the institutional outcome.
2. **Composed playbooks** — which playbook(s) this workflow operationalizes.
3. **Composed engines** — which existing engines provide the signals each step consumes. No new analytics.
4. **Severity gate** — the severity bands at which the workflow may be offered.
5. **Readiness gate** — the readiness conditions required.
6. **Step sequence** — the ordered, deterministic step contract a composition engine can read.
7. **Deferral semantics** — what the workflow returns when conditions are not met. Deferral is a method outcome.
8. **Reciprocity terms** — the institution's commitments to stewards engaged by the workflow.
9. **Persistence sketch (non-binding)** — candidate table/column names. No migrations.

## 4. Sequencing rules

When multiple workflows are eligible for an institution, the sequencing engine ([`workflowSequencing.ts`](../../../../apps/union-eyes/lib/workbook/engines/workflows/workflowSequencing.ts)) applies the following rules in order:

1. **Recognition precedes intervention.** Workflows are offered only after the Recognition phase exit condition is met.
2. **Reduction precedes addition.** Continuity Capture and Stewardship Redistribution precede Modernization Remediation when both are eligible.
3. **Severity governs precedence within an eligibility class.** Critical-band readings precede Elevated-band readings.
4. **Readiness gates absolute.** A workflow with unmet readiness is deferred regardless of severity.
5. **Reciprocity ratification gates Stewardship Redistribution.** Without ratified terms, the workflow is held in deferral.

## 5. What workflows do not do

Workflows do not:

- Execute autonomously,
- Bypass facilitator judgement,
- Schedule sessions,
- Track person-level performance,
- Generate KPIs,
- Carry surveillance affordances,
- Persist to a database in the current sprint.

A workflow returned by the composition engine is an **offer** the facilitator reviews with the governance body. The institution may decline any workflow or any step within it.

## 6. Composition engine surface

The composition engine for the workflow layer is [`stabilizationWorkflowEngine.ts`](../../../../apps/union-eyes/lib/workbook/engines/workflows/stabilizationWorkflowEngine.ts). It composes:

- Severity readings from `stabilizationPriorityEngine`,
- Redistribution readings from `continuityRedistributionPlanner` via `stewardshipRedistributionEngine`,
- Lineage readings from `continuityLineageEngine` via `governanceRecoveryEngine`,
- Maturity readings from `ociMaturityPathway`.

It introduces no new analytics. It emits a canonical signal envelope and a sequenced workflow offer.
