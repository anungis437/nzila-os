# OCI Question Architecture Inventory

ARTIFACT_TYPE: Question Architecture Audit™ — Part 1
DOCTRINE_VERSION: 1.1.0
AUDIT_VERSION: 1.0.0
GROUND_TRUTH_AS_OF: 2026-05-23
SCOPE: Authoritative inventory of every prompt the OCRA / OCI surface puts in front of a human, with framework linkage and signal metadata.

> **Posture.** This document is the ground-truth registry against which all subsequent audit parts (signal depth, diversity, entropy coverage, confidence generation, longitudinal survivability, statistical interpretability, adaptive routing, evidence extraction, procurement defensibility, HCT alignment) are graded. If a question is not listed here, the audit does not see it.

---

## 1. Top-level inventory

| Surface | Source | Items | Modalities | Framework linkage | Routing role |
|---|---|---|---|---|---|
| ICRA scored question bank | [apps/union-eyes/lib/icra/questions.ts](../../../../apps/union-eyes/lib/icra/questions.ts) | **54** | `maturity_select` × 42, `likert_5` × 7, `multiple_choice` × 5 | SDI · RBI · GES · CSM · CBM | Core bank (adaptive routing engine pinned to safe-default full-bank fallback in v1) |
| ICRA metadata (profile) | [apps/union-eyes/lib/icra/questions.ts](../../../../apps/union-eyes/lib/icra/questions.ts) | **6** | `select` × 5, `text` × 1 | Profile classification only | Tunes `InstitutionalAssessmentProfile`; no scoring impact |
| ICRA intelligence metadata | [apps/union-eyes/lib/icra/questionIntelligenceMetadata.ts](../../../../apps/union-eyes/lib/icra/questionIntelligenceMetadata.ts) | 54 declarations | structured metadata | Modality role + intelligence contribution + longitudinal/statistical/reviewer utility | Interpretation & report |
| Adaptive eligibility rules | [apps/union-eyes/lib/icra/adaptation/questionEligibilityRules.ts](../../../../apps/union-eyes/lib/icra/adaptation/questionEligibilityRules.ts) | 8 decision branches | predicate rules | 4 inclusion bands (`core`, `required`, `recommended`, `contextual`) | Safe-default fallback if routed count < 18 |
| Facilitation guides | [apps/union-eyes/lib/oci/facilitation/facilitationGuide.ts](../../../../apps/union-eyes/lib/oci/facilitation/facilitationGuide.ts) | 5 session arcs | structured editorial | Session-type specific | Workshop choreography |
| Workshop flows | [apps/union-eyes/lib/oci/facilitation/executiveWorkshopFlows.ts](../../../../apps/union-eyes/lib/oci/facilitation/executiveWorkshopFlows.ts) | 5 flows × 5–7 steps | structured prompts | Per-session arcs | Step-by-step facilitator script |
| Institutional discovery framework | [apps/union-eyes/lib/oci/facilitation/institutionalDiscoveryFramework.ts](../../../../apps/union-eyes/lib/oci/facilitation/institutionalDiscoveryFramework.ts) | 5 sections × 5 prompts = **25** | open discovery | Governance · Stewardship · Continuity · Modernization · Politics | Pre-assessment mapping |
| Continuity conversation prompts | [apps/union-eyes/lib/oci/conversations/continuityConversationPrompts.ts](../../../../apps/union-eyes/lib/oci/conversations/continuityConversationPrompts.ts) | 8 categories × 4–5 prompts ≈ **48** | open-ended editorial | Eight continuity categories | Ad-hoc free-draw facilitation |
| OCI frameworks (consumers) | [apps/union-eyes/lib/oci/frameworks/](../../../../apps/union-eyes/lib/oci/frameworks) | 5 | n/a | SDI · RBI · GES · CSM · CBM | Score generation from inventoried questions |

**Verified counts (2026-05-23, grep on questions.ts):**
`maturity_select` = 42 · `likert_5` = 7 · `multiple_choice` = 5 · `select` (metadata) = 6 · `text` (metadata) = 1.

---

## 2. Section × dimension matrix (scored bank)

| Section | Maturity | Likert | Choice | Total | Primary framework | Dimensions touched |
|---|---:|---:|---:|---:|---|---|
| `operational_dependency` | 7 | 1 | 1 | 9 | SDI · CBM | institutional_continuity · operational_memory · stewardship_distribution |
| `governance_visibility` | 5 | 1 | 1 | 7 | GES | governance_fragility · trust_debt |
| `institutional_memory` | 7 | 1 | 1 | 9 | RBI | operational_memory · institutional_continuity |
| `transition_readiness` | 6 | 1 | 1 | 8 | CSM | transition_readiness · stewardship_distribution |
| `operational_coordination` | 6 | 1 | 0 | 7 | RBI · CBM | operational_memory · trust_debt |
| `explainability_trust` | 5 | 0 | 0 | 5 | GES · CBM | trust_debt · governance_fragility |
| `sovereignty_governance` | 6 | 0 | 0 | 6 | GES · RBI | governance_fragility · operational_memory |
| **Totals** | **42** | **7** | **5** | **54** | — | 5 dimensions, 8 sections |

---

## 3. Per-question registry — required fields

Each scored question records the following fields (verified present for 54/54):

| Field | Storage | Required |
|---|---|---|
| Question ID | `Question.id` | yes |
| Domain (`section`) | `Question.section` | yes |
| Framework linkage | inferred via `section` + dimension weights | yes (derived) |
| Adaptive role | `Question.weight ∈ {core, required, recommended, contextual}` | yes (currently 100% `core` in v1) |
| Signal category (modality role) | `questionIntelligenceMetadata.modalityRole` | yes |
| Evidence dependency | derived from facilitation linkage; **explicit per-question evidence dependency NOT YET CAPTURED** (Gap-1) | partial |
| Confidence impact | `intelligenceContribution[]` + `confidenceSensitivity` | yes |
| Longitudinal utility | `intelligenceContribution[]` flagged on 7 `likert_5` items | partial |
| Statistical utility | derived; **not explicitly tagged per question** (Gap-2) | partial |
| Reviewer dependency | derived from facilitation prompt cross-link; **not explicit** (Gap-3) | partial |

> **Gap-1 / Gap-2 / Gap-3** are picked up in [QUESTION_REDESIGN_ROADMAP.md](QUESTION_REDESIGN_ROADMAP.md) as `High` priority for v1.2.0.

---

## 4. Facilitation surface (post-assessment)

The facilitation surface is canonically defined but **not yet integrated into the live UI**. The audit treats it as authored doctrine and grades it on the same signal-quality bar as the assessment.

| Surface | Items | Authored? | UI integrated? | Tests? |
|---|---:|---|---|---|
| Facilitation guides (5 session types) | 5 | ✅ | ❌ (Gap-4) | ✅ ([facilitationGuide.test.ts](../../../../apps/union-eyes/lib/oci/facilitation/__tests__/facilitationGuide.test.ts)) |
| Executive workshop flows | 5 × 5–7 steps | ✅ | ❌ (Gap-4) | ✅ |
| Institutional discovery framework | 5 sections × 5 prompts | ✅ | ❌ (Gap-4) | ✅ |
| Continuity conversation prompts | 8 categories × ~6 prompts | ✅ | ❌ (Gap-4) | ✅ |

---

## 5. Modality distribution vs. doctrine bounds

From [docs/oci/assessment/OCI_MODALITY_DOCTRINE.md](../assessment/OCI_MODALITY_DOCTRINE.md):

| Modality | Doctrine target | Observed | Status |
|---|---|---:|---|
| `maturity_select` | **65 – 75 %** | **77.8 %** (42/54) | ⚠️ **BREACH — above ceiling** |
| `likert_5` | 6 – 8 items | 7 | ✅ within band |
| `multiple_choice` | 4 – 6 items | 5 | ✅ within band |

**Finding M-1 (High).** The scored bank exceeds the `maturity_select` ceiling of 75 % by 2.8 percentage points. To return to compliance the bank must either:
- (a) reduce `maturity_select` by ≥ 2 items (target = 40), or
- (b) raise `likert_5` / `multiple_choice` / new modalities by ≥ 4 items (target denominator = 56 → 42/56 = 75 %).

The audit recommends **option (b)**, because adding signal diversity addresses the deeper finding ([Signal Diversity Audit](SIGNAL_DEPTH_AND_DIVERSITY_AUDIT.md) §3) rather than merely shrinking the bank.

This finding is **enforced** by [`maturitySelectCeiling.test.ts`](../../../../apps/union-eyes/lib/icra/__tests__/signal-integrity/maturitySelectCeiling.test.ts) which currently runs as a `MUST_EVENTUALLY_PASS` invariant (failing assertion documented; resolved when v1.2.0 ships).

---

## 6. Adaptive routing — actual vs. designed state

| Aspect | Designed | Actual (v1) | Gap |
|---|---|---|---|
| Routing engine | 8-rule precedence with band classification | ✅ implemented | none |
| Per-question adaptive metadata | every question declares `suppressedFor` / `requiredFor` / `recommendedFor` | ❌ **zero questions declare adaptive metadata** | **Gap-R1 (Critical)** |
| Profile classification | `InstitutionalAssessmentProfile` with 5 fields + rationale | ✅ implemented | none |
| Minimum routed count | ≥ 18 questions | enforced via safe-default fallback | none |
| Selection fingerprint | low-cardinality, no PII | ✅ implemented | none |
| Effective behaviour today | tailored subset by profile | **always returns full bank** (safe default) | **Gap-R1 (Critical)** |

> **Gap-R1 (Critical).** Adaptive routing is structurally present but **functionally inert** because no question carries adaptive metadata. The system therefore presents the full 54-question bank to every respondent regardless of profile. Routing audit ([ADAPTIVE_ROUTING_AUDIT.md](ADAPTIVE_ROUTING_AUDIT.md)) classifies current routing as `Cosmetic` until per-question adaptive metadata is populated.

---

## 7. Anti-surveillance posture (verified)

The inventory confirms the following anti-surveillance invariants are upheld by 54/54 scored items and all facilitation prompts:

- No prompt asks for an individual's name, performance rating, or behavioural attribute.
- No prompt asks for a department or team name to be associated with an individual.
- No multiple-choice option carries a "correct" or "incorrect" label.
- No `likert_5` statement is phrased as an opinion about a person or as a satisfaction measure.
- No prompt requests private member data, free-text disclosures about specific people, or psychological state.

These invariants are continuously verified by [antiGamificationInvariant.test.ts](../../../../apps/union-eyes/lib/icra/__tests__/antiGamificationInvariant.test.ts).

---

## 8. Cross-references

- Signal depth + diversity: [SIGNAL_DEPTH_AND_DIVERSITY_AUDIT.md](SIGNAL_DEPTH_AND_DIVERSITY_AUDIT.md)
- Entropy signal gaps: [ENTROPY_SIGNAL_GAP_REPORT.md](ENTROPY_SIGNAL_GAP_REPORT.md)
- Confidence generation: [CONFIDENCE_GENERATION_AUDIT.md](CONFIDENCE_GENERATION_AUDIT.md)
- Longitudinal survivability: [LONGITUDINAL_SURVIVABILITY_AUDIT.md](LONGITUDINAL_SURVIVABILITY_AUDIT.md)
- Statistical interpretability: [STATISTICAL_INTERPRETABILITY_AUDIT.md](STATISTICAL_INTERPRETABILITY_AUDIT.md)
- Adaptive routing: [ADAPTIVE_ROUTING_AUDIT.md](ADAPTIVE_ROUTING_AUDIT.md)
- Evidence extraction: [EVIDENCE_EXTRACTION_AUDIT.md](EVIDENCE_EXTRACTION_AUDIT.md)
- Procurement defensibility: [QUESTION_ARCHITECTURE_PROCUREMENT_REVIEW.md](QUESTION_ARCHITECTURE_PROCUREMENT_REVIEW.md)
- Human Continuity Theory alignment: [HUMAN_CONTINUITY_THEORY_ALIGNMENT.md](HUMAN_CONTINUITY_THEORY_ALIGNMENT.md)
- Redesign roadmap: [QUESTION_REDESIGN_ROADMAP.md](QUESTION_REDESIGN_ROADMAP.md)
- Governance: [QUESTION_ARCHITECTURE_GOVERNANCE.md](QUESTION_ARCHITECTURE_GOVERNANCE.md)
