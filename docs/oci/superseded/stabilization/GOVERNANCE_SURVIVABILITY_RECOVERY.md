# Governance Survivability Recovery™

**Status:** Canonical Product 3 framework document. Names the framework dimension; the playbook ([playbooks/GOVERNANCE_LINEAGE_RECOVERY.md](playbooks/GOVERNANCE_LINEAGE_RECOVERY.md)) names how the framework is delivered inside an engagement. The composition engine that surfaces recovery readings is `governanceRecoveryEngine`.

**Audience:** Certified facilitators, governance bodies, internal stewards of the method.

---

## 1. Purpose

The Governance Survivability Recovery™ framework addresses an institution's capacity to survive governance transitions without losing the interpretation, precedent, and policies-in-practice carried by current stewards. The framework reads what would be lost in a transition, recovers what is recoverable, and codifies the recovered material in governance-receivable form.

The framework refuses the audit-of-past-practice framing. The recovery is institutional record reconstruction, not retrospective fault attribution. Stewards whose interpretation contributed to the recovery are recognised as carriers of institutional memory.

## 2. Framework principles

1. **Recovery, not audit.** The framework recovers institutional record; it does not adjudicate past practice.
2. **Ratification required.** Recovered material is brought to the governance body for ratification before it becomes institutional record.
3. **Distinguishing recovered from reconstructed.** The framework explicitly marks material as recovered (still carried), reconstructed (rebuilt from secondary sources), or unresolved.
4. **No fault attribution.** The recovery does not attribute fault to stewards whose tenure preceded any lapse.
5. **Steward dignity.** Stewards whose interpretation contributed to the recovery are named as contributors in the institutional record.

## 3. Composed engines

The framework reads its institutional state by composing the following workbook engines:

| Engine | Read |
|--------|------|
| `governanceInterpretationMatrix` | Governance interpretation carried by stewards. |
| `governanceEntropyEngine` | Aggregate governance design-practice drift. |
| `continuityLineageEngine` | Precedent survivability layer and aggregate interpretation drift. |
| `governanceModernizationReview` | Modernization moves affecting governance practice. |
| `institutionalEvolutionTracker` | Institutional posture toward governance evolution. |

The composition is performed by [`governanceRecoveryEngine.ts`](../../../../apps/union-eyes/lib/workbook/engines/governanceRecoveryEngine.ts) (composition only — no new analytics).

## 4. Signal envelope

The composition engine emits signals per [OCI_STABILIZATION_SEVERITY_MODEL.md](OCI_STABILIZATION_SEVERITY_MODEL.md). Signal categories:

- `lapsed_precedent_recovery_required` — lapsed precedents present; reconstruction recommended.
- `interpretation_drift_present` — aggregate interpretation drift above threshold.
- `living_lineage_carries_recovery` — majority share is living lineage; recovery consolidates rather than reconstructs.
- `no_lineage_surface` — no lineage surface yet present; recognition continuation is the honest next step.
- `governance_ratification_pending` — recovery material present without governance commitment to ratification.

## 5. Workbook surface

The recovery reading is surfaced in workbook executive reporting through Chapter 08 ("Stabilization Direction"), where the chapter is rendered only when the engagement is facilitated and the lineage rows are authoritatively projectable. In self-guided posture or with absent lineage rows, the chapter is reserved for the Facilitated Edition.

## 6. Engagement use

A Product 3 engagement that engages this framework dimension runs the [Governance Lineage Recovery playbook](playbooks/GOVERNANCE_LINEAGE_RECOVERY.md). The framework document defines the dimension; the playbook defines the delivery.

## 7. Doctrine references

- [OCI_METHOD.md](../../OCI_METHOD.md)
- [OCI_STABILIZATION_FRAMEWORK.md](OCI_STABILIZATION_FRAMEWORK.md)
- [OCI_INTERVENTION_MODEL.md](OCI_INTERVENTION_MODEL.md)
- [OCI_STABILIZATION_LIFECYCLE.md](OCI_STABILIZATION_LIFECYCLE.md)
- [OCI_STABILIZATION_SEVERITY_MODEL.md](OCI_STABILIZATION_SEVERITY_MODEL.md)
- [OCI_STABILIZATION_PERSONAS.md](OCI_STABILIZATION_PERSONAS.md)
- [OCI_INTERVENTION_ETHICS.md](OCI_INTERVENTION_ETHICS.md)
- [playbooks/GOVERNANCE_LINEAGE_RECOVERY.md](playbooks/GOVERNANCE_LINEAGE_RECOVERY.md)
- [OCI_ANTI_SURVEILLANCE_POSITION.md](../../OCI_ANTI_SURVEILLANCE_POSITION.md)
- [OCI_AI_BOUNDARY.md](../../OCI_AI_BOUNDARY.md)
- [OCI_DATA_HANDLING.md](../../OCI_DATA_HANDLING.md)
