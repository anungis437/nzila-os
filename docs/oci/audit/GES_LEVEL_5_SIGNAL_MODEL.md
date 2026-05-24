# GES Level 5 Signal Model

**Status**: v1.2.0-foundation
**Closes**: Audit finding **E-1** (GES Level 5 had no direct probe in the v1.1.x question pool).
**Authority**: This document is the canonical signal model for GES Level 5 extraction. Implementation: `apps/union-eyes/lib/icra/ges-level5/probes.ts`.

---

## Doctrine

GES Level 5 ("Resilient & Self-Renewing") cannot be inferred from compliance-style maturity ladders. It requires *direct extraction* of institutional resilience, redundancy, and reconstruction signals. The v1.2.0 foundation introduces a probe registry — each probe pairs a Level-5 assertion with the v2 modality questions that contribute to its extraction.

A Level-5 signal is considered **evidenced** only when:

1. Every contributing v2 question reaches the probe's declared `evidenceFloor` (`OPERATIONAL` minimum).
2. No active contradiction in the contradiction registry penalizes the same dimension.
3. The confidence envelope for the underlying dimension is ≥ 0.55 after contradiction penalties.

Any other state is **declared** (not evidenced) and surfaces with a caution annotation in the OCI report.

---

## Level-5 Signals

| Signal ID | Assertion | Contributing v2 Questions | Evidence Floor |
| --- | --- | --- | --- |
| `governance_self_healing` | The institution recovers from governance interpretive drift without external intervention. | `v2_cp_governance_interpretation`, `v2_sm_governance_interpretation_through_transition` | `OPERATIONAL` |
| `successor_operational_autonomy` | New senior leaders achieve independent operational effectiveness without informal apprenticeship. | `v2_cp_onboarding_durability`, `v2_es_succession_plan` | `OPERATIONAL` |
| `institutional_memory_redundancy` | Critical institutional knowledge is distributed across functions, not concentrated in single stewards. | `v2_cd_stewardship_concentration`, `v2_cp_stewardship_recoverability` | `OPERATIONAL` |
| `cross_functional_continuity_resilience` | Continuity holds across functional boundaries. | `v2_tm_continuity_centrality`, `v2_dm_governance_operational_dependency` | `OPERATIONAL` |
| `continuity_transfer_survivability` | Continuity practices survive transfers of senior responsibility intact. | `v2_sm_governance_interpretation_through_transition`, `v2_te_leadership_exposure_window` | `OPERATIONAL` |
| `governance_reconstruction_independence` | Governance rationale can be reconstructed without consulting those who produced it. | `v2_cm_reconstruction_confidence`, `v2_es_continuity_policy` | `VERIFIED` |
| `modernization_continuity_resilience` | Modernization decisions over the most recent cycle preserved continuity. | `v2_cm_modernization_uncertainty` (v1.3.0 adds structural complements) | `OPERATIONAL` |
| `procedural_inheritance_durability` | Operational procedures persist through transitions without silent reinvention. | `v2_sm_governance_interpretation_through_transition`, `v2_cd_stewardship_concentration` | `OPERATIONAL` |

---

## Anti-Claims

- No probe in this model names individuals.
- No probe infers political, behavioural, or productivity signals.
- All distribution and topology inputs operate over institutional **functions or role categories**, never persons.
- A Level-5 declaration without evidenced confirmation is **not** rendered as Level-5 attainment; it is rendered as a *declared aspiration with insufficient evidence*.

---

## Reviewer Interpretation

Level-5 evidenced signals are the strongest continuity claims the OCI produces. Reviewers should:

- Confirm `evidenceFloor` is met for all contributing questions before accepting attainment.
- Treat contradiction-penalty interaction as authoritative — a Level-5 claim that conflicts with an unresolved contradiction is downgraded.
- Use the per-signal `rationale` field as the audit-trail explanation in the final report.
