# Question Pool v2.0 — Roadmap

**Status**: v1.2.0-foundation (staging registry shipped)
**Authority**: Canonical roadmap for the migration of the OCRA/OCI question pool from v1.x maturity-ladder dominance to v2.x sophisticated-signal extraction.

---

## Doctrine

The v1.x pool was dominated by `maturity_select` and `likert_5` ladders. The v1.1.1 audit confirmed three structural deficits:

- **M-1**: `maturity_select` represented only 77.8 % of the pool against a 45–60 % institutional target.
- **R-1**: adaptive routing was functionally inert — it skipped questions to shorten surveys rather than deepening extraction in fragile areas.
- **E-1**: GES Level 5 lacked direct probes.
- **C-3**: `trust_debt` was over-collected via `likert_5` without contradiction or evidence support.

v2.0 redesigns the pool around eight new modalities, an evidence-strength ladder, a contradiction-detection engine, GES Level 5 probes, and deepening adaptive routing.

---

## Migration Waves

| Wave | Scope | Status |
| --- | --- | --- |
| **1.2.0-foundation** | v2 modality type system + 11 seed questions + contradiction engine + evidence taxonomy + GES L5 probes + routing-v2 path types + doctrine docs | **Shipped** |
| **1.3.0-integration** | Modernization-fragility question set (7 themes); evidence-strength follow-up sub-questions for all `evidence_strength` registry entries; `federated_governance` dependency-mapping expansion | Planned |
| **1.4.0-routing-engine** | Live routing engine consuming `ROUTING_PATHS`; runtime activation telemetry; routing-path test coverage matrix | Planned |
| **1.5.0-pool-rebalance** | Fold v2 modalities into active OCRA flow; rebalance `maturity_select` to 45–60 % of total pool; deprecate redundant `likert_5` items per priority taxonomy | Planned |
| **1.6.0-scoring-integration** | Scoring engine consumes contradiction penalties + evidence floors + GES L5 evidenced/declared split; narrative engine renders contradictions with reviewer guidance | Planned |

---

## Priority Taxonomy

When migrating individual questions out of the v1 pool, classify each per the following taxonomy:

| Priority | Definition | Action |
| --- | --- | --- |
| **Replace** | Weak signal; another v2 modality covers the same dimension better. | Deprecate v1 question; add v2 replacement; record mapping. |
| **Refactor** | Signal is real but structurally weak (e.g., overloaded prompt). | Split into focused v2 questions. |
| **Expand** | Signal is real but extraction depth is insufficient. | Add deepening probes via routing-v2 paths. |
| **Split** | Question conflates multiple signals (common with `likert_5` in `trust_debt`). | Decompose into separate `confidence_marker` + `evidence_strength` pair. |
| **Remove** | Cosmetic or noisy — no demonstrated contribution. | Delete; record rationale in changelog. |
| **Escalate** | Signal requires reviewer or external evidence. | Re-classify as reviewer-driven; remove from auto-pool. |

Migration decisions are recorded in `docs/oci/audit/v1_to_v2_question_map.md` (v1.3.0 deliverable).

---

## Quality Targets

| Target | v1.1.1 Actual | v2.0 Target |
| --- | --- | --- |
| `maturity_select` share | 77.8 % | 45–60 % |
| Contradiction-pair coverage | 0 % | ≥ 3 pairs across onboarding / governance / stewardship |
| Evidence-strength coverage on governance & continuity dimensions | 0 % | ≥ 2 anchors per dimension |
| GES L5 direct probes | 0 | ≥ 1 contributing question per L5 signal |
| Routing path types | 0 active | 7 declared paths (v1.4.0 activates) |
| Confidence-marker presence in `trust_debt` | 0 | ≥ 2 |

---

## Anti-Drift Guards

- Every wave must preserve all anti-claims documented in `GES_LEVEL_5_SIGNAL_MODEL.md` and `MODERNIZATION_INSTABILITY_SIGNAL_MODEL.md`.
- No wave may reduce the count of evidenced (vs declared) signals in the L5 model.
- No wave may introduce surveillance-style probes — distribution / dependency / topology modalities operate over institutional functions, never persons.
- Contradiction detection must always reduce confidence; never average away.

---

## Reviewer Note

The v1.2.0-foundation deliberately keeps the v2 modalities in an **isolated registry** (`apps/union-eyes/lib/icra/modalities-v2/`) and does NOT fold them into the active `Question` union. This staging is intentional — folding without scoring + narrative + UI migration would silently break the runtime OCI pipeline. The integration is tracked through waves 1.3.0 → 1.6.0 above.
