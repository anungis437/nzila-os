# Stewardship Redistribution Framework™

**Status:** Canonical Product 3 framework document. Names the framework dimension; the playbook ([playbooks/STEWARDSHIP_REDISTRIBUTION.md](playbooks/STEWARDSHIP_REDISTRIBUTION.md)) names how the framework is delivered inside an engagement. The composition engine that surfaces redistribution readings is `stewardshipRedistributionEngine`.

**Audience:** Certified facilitators, governance bodies, internal stewards of the method.

---

## 1. Purpose

The Stewardship Redistribution Framework™ is the OCI framework dimension addressing institutional stewardship concentration. It frames redistribution as the broadening of carriers without diminishment of the originating steward — recognition preserved, standing maintained or enhanced, reciprocity ratified before sequence start.

The framework refuses the redistribution-as-replacement framing. A steward whose practice is broadened to additional carriers remains the originating carrier, named in the institutional record and held in continued standing.

## 2. Framework principles

1. **Reciprocity first.** Reciprocity terms are ratified before any broadening sequence begins.
2. **Recognition preserved.** The originating steward's standing is preserved or enhanced by the redistribution, never reduced.
3. **Carrier broadening, not carrier replacement.** The framework broadens the set of carriers; it does not replace the originating carrier with another.
4. **Consent revocable.** The originating steward and the candidate carrier may withdraw consent at any point.
5. **Institutional arrangement, not personal evaluation.** The redistribution is recorded as institutional arrangement; it is never used as input to per-person evaluation.

## 3. Composed engines

The framework reads its institutional state by composing the following workbook engines:

| Engine | Read |
|--------|------|
| `stewardshipCartography` | Carrier exposure profile of the institution. |
| `continuityDependencyGraph` | Carrier, process, and governance-body dependencies. |
| `continuityRedistributionPlanner` | Carrier backup, process broadening, and lineage capture targets. |
| `onboardingFragilityAnalysis` | Successor-readiness conditions for each role. |
| `governanceInterpretationMatrix` | Governance interpretation carried by the institution's stewards. |

The composition is performed by [`stewardshipRedistributionEngine.ts`](../../apps/union-eyes/lib/workbook/engines/stewardshipRedistributionEngine.ts) (composition only — no new analytics).

## 4. Signal envelope

The composition engine emits signals per [OCI_STABILIZATION_SEVERITY_MODEL.md](OCI_STABILIZATION_SEVERITY_MODEL.md). Signal categories:

- `monopoly_concentration` — carrier concentration above the monopoly threshold.
- `single_carrier_undocumented_cluster` — cluster of single-carrier undocumented processes.
- `lineage_lapse_concentration` — lapsed precedent presence.
- `broadening_ready` — reciprocity ratified and broadening candidates sequenced.
- `reciprocity_terms_required` — broadening targets present without ratified reciprocity.
- `no_redistribution_targets` — no targets surfaced; recognition continuation is the honest next step.

## 5. Workbook surface

The redistribution reading is surfaced in workbook executive reporting through Chapter 08 ("Stabilization Direction"), where the chapter is rendered only when the engagement is facilitated and the underlying engines have ratified inputs. In self-guided posture or with absent inputs, the chapter is reserved for the Facilitated Edition (no projection is attempted).

## 6. Engagement use

A Product 3 engagement that engages this framework dimension runs the [Stewardship Redistribution playbook](playbooks/STEWARDSHIP_REDISTRIBUTION.md). The framework document defines the dimension; the playbook defines the delivery.

## 7. Doctrine references

- [OCI_METHOD.md](../OCI_METHOD.md)
- [OCI_STABILIZATION_FRAMEWORK.md](OCI_STABILIZATION_FRAMEWORK.md)
- [OCI_INTERVENTION_MODEL.md](OCI_INTERVENTION_MODEL.md)
- [OCI_STABILIZATION_LIFECYCLE.md](OCI_STABILIZATION_LIFECYCLE.md)
- [OCI_STABILIZATION_SEVERITY_MODEL.md](OCI_STABILIZATION_SEVERITY_MODEL.md)
- [OCI_STABILIZATION_PERSONAS.md](OCI_STABILIZATION_PERSONAS.md)
- [OCI_INTERVENTION_ETHICS.md](OCI_INTERVENTION_ETHICS.md)
- [playbooks/STEWARDSHIP_REDISTRIBUTION.md](playbooks/STEWARDSHIP_REDISTRIBUTION.md)
- [OCI_ANTI_SURVEILLANCE_POSITION.md](../OCI_ANTI_SURVEILLANCE_POSITION.md)
- [OCI_AI_BOUNDARY.md](../OCI_AI_BOUNDARY.md)
- [OCI_DATA_HANDLING.md](../OCI_DATA_HANDLING.md)
