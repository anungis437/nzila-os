# Question Redesign Roadmap

ARTIFACT_TYPE: Question Architecture Audit™ — Part 12
DOCTRINE_VERSION: 1.1.0
AUDIT_VERSION: 1.0.0
TARGET_RELEASE: OCI Method™ v1.2.0 (signal-architecture rebalance) and v1.3.0 (longitudinal substrate)

> **Roadmap posture.** Every redesign item below traces back to a named finding in Parts 1–11. No item is invented; no item is cosmetic.

---

## 1. Priority classes

| Class | Definition | SLA |
|---|---|---|
| **Critical** (methodological) | Without this fix, the methodology emits a claim it cannot defend. | v1.2.0 |
| **High** (signal) | Without this fix, the bank carries a doctrine breach or coverage gap. | v1.2.0 |
| **Medium** (confidence) | Without this fix, an envelope field is below its sufficiency floor. | v1.2.0 or v1.3.0 |
| **Low** (UX) | Without this fix, the assessment is harder to administer but no claim is at risk. | v1.3.0 |

---

## 2. Critical items (v1.2.0)

| ID | Source finding | Item | Acceptance |
|---|---|---|---|
| **R-C1** | [ENTROPY_SIGNAL_GAP_REPORT.md](ENTROPY_SIGNAL_GAP_REPORT.md) E-1 | Add 2 GES-level-5 probes (1 `multiple_choice` topology + 1 `likert_5` confidence) | GES level 5 has ≥ 1 direct probe; `entropyCoverage.test.ts` level-5 assertion passes |
| **R-C2** | [ADAPTIVE_ROUTING_AUDIT.md](ADAPTIVE_ROUTING_AUDIT.md) R-1 | Populate per-question adaptive metadata (`requiredFor` / `recommendedFor` / `suppressedFor`) for ≥ 80 % of bank | `adaptiveRouteDepth.test.ts` Jaccard-distance assertion passes |
| **R-C3** | [CONFIDENCE_GENERATION_AUDIT.md](CONFIDENCE_GENERATION_AUDIT.md) C-3 | Add `multiple_choice` topology probe for `trust_debt` dimension | `confidenceGenerationCoverage.test.ts` trust_debt modality-diversity = 3 |

---

## 3. High items (v1.2.0)

| ID | Source finding | Item | Acceptance |
|---|---|---|---|
| **R-H1** | [QUESTION_ARCHITECTURE_INVENTORY.md](QUESTION_ARCHITECTURE_INVENTORY.md) §5 (M-1) | Rebalance `maturity_select` share to ≤ 75 % via **adding** modality-diverse items (Option B) | `maturitySelectCeiling.test.ts` passes; bank size = 56–60 |
| **R-H2** | [SIGNAL_DEPTH_AND_DIVERSITY_AUDIT.md](SIGNAL_DEPTH_AND_DIVERSITY_AUDIT.md) SD-B | Add 2 `SD-10 Operational fallback visibility` items | Signal-diversity coverage check passes |
| **R-H3** | [SIGNAL_DEPTH_AND_DIVERSITY_AUDIT.md](SIGNAL_DEPTH_AND_DIVERSITY_AUDIT.md) SD-D | Add 2 `SD-2 Dependency mapping` items | Signal-diversity coverage check passes |
| **R-H4** | [HUMAN_CONTINUITY_THEORY_ALIGNMENT.md](HUMAN_CONTINUITY_THEORY_ALIGNMENT.md) HCT-B | Introduce `continuity-debt-index.ts` framework | Framework consumes ≥ 4 inputs; emits envelope-compliant output |
| **R-H5** | [HUMAN_CONTINUITY_THEORY_ALIGNMENT.md](HUMAN_CONTINUITY_THEORY_ALIGNMENT.md) HCT-C | Introduce `modernization-fragility-index.ts` framework | Framework consumes ≥ 4 inputs; emits envelope-compliant output |
| **R-H6** | [STATISTICAL_INTERPRETABILITY_AUDIT.md](STATISTICAL_INTERPRETABILITY_AUDIT.md) S-5 | Add `multiple_choice` topology probe for governance-authority HHI | HHI input set ≥ 3 |
| **R-H7** | [ENTROPY_SIGNAL_GAP_REPORT.md](ENTROPY_SIGNAL_GAP_REPORT.md) E-2 | Add 1 `multiple_choice` reconstruction-burden topology probe (GES level 4 modality diversity) | GES level 4 modality diversity ≥ 2 |
| **R-H8** | [ENTROPY_SIGNAL_GAP_REPORT.md](ENTROPY_SIGNAL_GAP_REPORT.md) E-4 | Add 1 `maturity_select` D4 prompt on policy-silence pattern (boundary between policy and practice) | Bank carries the missing interpretive coverage |

---

## 4. Medium items (v1.2.0)

| ID | Source finding | Item | Acceptance |
|---|---|---|---|
| **R-M1** | [SIGNAL_DEPTH_AND_DIVERSITY_AUDIT.md](SIGNAL_DEPTH_AND_DIVERSITY_AUDIT.md) SD-C | Cross-section modernization prompts (CSM and CBM both reference modernization survivability) | Modernization signals present in ≥ 3 frameworks |
| **R-M2** | [SIGNAL_DEPTH_AND_DIVERSITY_AUDIT.md](SIGNAL_DEPTH_AND_DIVERSITY_AUDIT.md) SD-A | Add doctrine note declaring deliberate empty SD-4 (Evidence confirmation) class; add optional non-scoring `evidence_anchor` prompt per section | Doctrine note merged; optional prompts present |
| **R-M3** | [EVIDENCE_EXTRACTION_AUDIT.md](EVIDENCE_EXTRACTION_AUDIT.md) EV-5 | Introduce optional `evidence_corroboration_record` in facilitation packet | Packet schema extended; facilitation guides updated |
| **R-M4** | [ENTROPY_SIGNAL_GAP_REPORT.md](ENTROPY_SIGNAL_GAP_REPORT.md) E-3 | Add governance-interpretation-drift `likert_5` + `multiple_choice` (raise coverage above 1 probe) | Coverage check passes |
| **R-M5** | [LONGITUDINAL_SURVIVABILITY_AUDIT.md](LONGITUDINAL_SURVIVABILITY_AUDIT.md) L-2 | Pair `mt_02` longitudinal report with modernization-activity normalization factor | Longitudinal report emits normalized trend |
| **R-M6** | [QUESTION_ARCHITECTURE_INVENTORY.md](QUESTION_ARCHITECTURE_INVENTORY.md) §3 Gap-2 | Explicitly tag `statisticalUtility` per question in `questionIntelligenceMetadata` | 100 % of scored bank carries the tag |
| **R-M7** | [QUESTION_ARCHITECTURE_INVENTORY.md](QUESTION_ARCHITECTURE_INVENTORY.md) §3 Gap-3 | Explicitly tag `reviewerDependency` per question | 100 % of scored bank carries the tag |

---

## 5. Low items (v1.3.0)

| ID | Source finding | Item | Acceptance |
|---|---|---|---|
| **R-L1** | [CONFIDENCE_GENERATION_AUDIT.md](CONFIDENCE_GENERATION_AUDIT.md) C-2 | Ship longitudinal answer store; activate stability-engine consumption | Stability field populated in envelope across ≥ 2 assessment cycles |
| **R-L2** | [QUESTION_ARCHITECTURE_INVENTORY.md](QUESTION_ARCHITECTURE_INVENTORY.md) §4 Gap-4 | Integrate facilitation surface into live UI (5 session types, 25 discovery prompts, 48 conversation prompts) | Facilitation surface invocable from console |
| **R-L3** | [STATISTICAL_INTERPRETABILITY_AUDIT.md](STATISTICAL_INTERPRETABILITY_AUDIT.md) S-4 | Empirical mathematically-weak-prompt pass once response volume sufficient | Empirical pass added to v1.3.0 audit cycle |
| **R-L4** | bilingual gap | Complete fr-CA translations for all new and existing prompts | i18n test asserts 100 % parity |

---

## 6. Net delta to the bank

| State | Bank size | Modality distribution |
|---|---:|---|
| Today (v1.1) | 54 | maturity 77.8 % / likert 13 % / choice 9.3 % |
| Post v1.2.0 (Critical + High) | 56–60 | maturity ≤ 75 % / likert ≥ 13 % / choice ≥ 14 % |
| Net change | +2 to +6 items | Brings `maturity_select` into doctrine band; raises diversity |

The net delta is small. **The audit is not recommending a bank rewrite.** It is recommending **targeted additions** that close defensibility gaps without disrupting the existing methodological backbone.

---

## 7. Acceptance & sequencing

All Critical and High items are required for v1.2.0 release. Medium items are recommended for v1.2.0 but acceptable in v1.3.0 if scheduling requires. Low items defer to v1.3.0.

Each item must:
1. Reference its source finding by ID.
2. Add or update tests that prove acceptance.
3. Update the [METHODOLOGY_CHANGELOG.md](../methodology/METHODOLOGY_CHANGELOG.md) with `change_class` and `affected_artifacts`.
4. Pass the [QUESTION_ARCHITECTURE_GOVERNANCE.md](QUESTION_ARCHITECTURE_GOVERNANCE.md) review checklist.
