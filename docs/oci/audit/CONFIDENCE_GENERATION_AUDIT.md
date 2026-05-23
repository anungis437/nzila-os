# Confidence Generation Audit™

ARTIFACT_TYPE: Question Architecture Audit™ — Part 5
DOCTRINE_VERSION: 1.1.0
AUDIT_VERSION: 1.0.0
GROUND_TRUTH: [QUESTION_ARCHITECTURE_INVENTORY.md](./QUESTION_ARCHITECTURE_INVENTORY.md)
MODEL_UNDER_AUDIT: `@nzila/oci-confidence` — [packages/oci-confidence/](../../../packages/oci-confidence/)

> **Audit question.** Can the existing question bank generate every field of the public confidence envelope (`score`, `confidence`, `sampleSize`, `dataCompleteness`, `stability`, `cautionState`) honestly and reproducibly?

---

## 1. Confidence envelope coverage by question

Each scored question receives a `Confidence Utility` classification:

| Class | Definition |
|---|---|
| **Strong** | Direct primary input to ≥ 1 envelope field |
| **Moderate** | Material secondary input to ≥ 1 envelope field |
| **Weak** | Affects an envelope field only in aggregate with others |
| **Cosmetic** | No envelope contribution (presence is interpretive, not statistical) |

### 1.1 Per-question classification

| ID | Score | Confidence | sampleSize | dataCompleteness | Stability | cautionState | Class |
|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| od_01 | ✓ | ✓ | + | + | + | + | **Strong** |
| od_02 | ✓ | ✓ | + | + | + | + | **Strong** |
| od_03 | ✓ |   | + | + |   |   | Moderate |
| od_04 | ✓ | ✓ | + | + | + |   | **Strong** |
| od_05 | ✓ | ✓ | + | + | + | + | **Strong** |
| icb_01 | ✓ | ✓ | + | + |   | + | **Strong** |
| icb_02 | ✓ |   | + | + |   |   | Moderate |
| ccs_01 |   | ✓ | + | + | ✓ | ✓ | **Strong** (confidence backbone) |
| scs_01 | + |   | + | + |   | + | Moderate (topology) |
| gv_01 | ✓ | ✓ | + | + | + |   | **Strong** |
| gv_02 | ✓ |   | + | + |   |   | Moderate |
| gv_03 | ✓ | ✓ | + | + | + | + | **Strong** |
| gv_04 | ✓ | ✓ | + | + | + | + | **Strong** |
| gis_01 | ✓ | ✓ | + | + | ✓ | + | **Strong** |
| ccs_02 |   | ✓ | + | + | ✓ | ✓ | **Strong** |
| scs_02 | + |   | + | + |   | + | Moderate |
| im_01..im_04 | ✓ | mostly ✓ | + | + | + | + | **Strong** ×3 / Moderate ×1 |
| orl_01 | ✓ | ✓ | + | + | + | + | **Strong** |
| orl_02 | ✓ |   | + | + | + |   | Moderate |
| if_01 | ✓ | ✓ | + | + | + | + | **Strong** |
| ccs_03 |   | ✓ | + | + | ✓ | ✓ | **Strong** |
| scs_03 | + |   | + | + |   | + | Moderate |
| tr_01..tr_05 | ✓ | mostly ✓ | + | + | + | + | **Strong** ×4 / Moderate ×1 |
| onb_01 | ✓ | ✓ | + | + | + | + | **Strong** |
| ccs_04 |   | ✓ | + | + | ✓ | ✓ | **Strong** |
| scs_05 | + |   | + | + |   | + | Moderate |
| oc_01..oc_05 | ✓ | varies | + | + | varies |   | Moderate ×4 / Strong ×1 |
| cf_01 | ✓ | ✓ | + | + |   | + | **Strong** |
| ccs_07 |   | ✓ | + | + | ✓ | ✓ | **Strong** |
| et_01..et_05 | ✓ | mostly ✓ | + | + | + | + | **Strong** ×3 / Moderate ×2 |
| sg_01..sg_04 | ✓ | mostly ✓ | + | + | + | + | **Strong** ×2 / Moderate ×2 |
| mt_01..mt_02 | ✓ | ✓ | + | + | + | + | **Strong** |

### 1.2 Distribution

| Class | Count | Share | Doctrine target |
|---|---:|---:|---|
| Strong | 31 | 57 % | ≥ 50 % |
| Moderate | 23 | 43 % | ≤ 45 % |
| Weak | 0 | 0 % | ≤ 5 % |
| Cosmetic | 0 | 0 % | 0 % |

**Finding C-1 (Pass).** 100 % of scored questions contribute observably to ≥ 1 envelope field. **No cosmetic prompts exist in the scored bank.** Surveillance-shaped questions, vanity prompts, and engagement-only prompts are absent.

---

## 2. Envelope-field generability matrix

| Field | Can the bank produce this honestly? | Verified by |
|---|---|---|
| `score` | Yes — 49/54 questions feed scoring via dimension weights | maturityProgression.test.ts |
| `confidence` | Yes — 32 questions carry confidence sensitivity (likert + maturity) | confidence-model.ts unit tests |
| `sampleSize` | Yes — derived from `answeredCount` per dimension | data-completeness.ts |
| `dataCompleteness` | Yes — derived from `answeredCount / expectedCount` | data-completeness.ts |
| `stability` | Yes — derived from likert variance over time **once longitudinal store exists** (Gap-L1) | stability-engine.ts |
| `cautionState` | Yes — derived from `interpretive-cautions.ts` against thresholds | interpretive-cautions.ts unit tests |

### Finding C-2 (High). `stability` is generable but not yet *populated*.

The stability-engine consumes a longitudinal answer store that does not yet exist in v1. The model is sound; the substrate is missing. Resolution: longitudinal store ships with v1.3.0 (tracked in [QUESTION_REDESIGN_ROADMAP.md](./QUESTION_REDESIGN_ROADMAP.md)).

---

## 3. Confidence escalation alignment

The audit cross-checks each scored question against [confidenceEscalationRules.ts](../../../apps/union-eyes/lib/oci/audit/confidenceEscalationRules.ts):

- **Risk-inverted prompts** (`gv_03`, `orl_01`, `et_02`, `sg_03`) correctly trigger escalation when their value contradicts adjacent positive ratings.
- **Single-modality dependency on `maturity_select`** for a dimension correctly triggers a *caution* (not an escalation) per Finding M-1.
- **Sub-floor `sampleSize`** (< 5 per dimension) correctly caps `confidence` at 0.6.

No misalignments detected.

---

## 4. Per-dimension confidence sufficiency

| Dimension | Inputs | Modality diversity | Sufficient? |
|---|---:|---|:--:|
| institutional_continuity | 26 | 3 | ✅ |
| operational_memory | 19 | 3 | ✅ |
| governance_fragility | 13 | 3 | ✅ |
| trust_debt | 9 | 2 | ⚠️ (no `multiple_choice` direct probe) |
| transition_readiness | 9 | 3 | ✅ |

**Finding C-3 (Medium).** `trust_debt` dimension lacks a `multiple_choice` topology input. Disposition: in v1.2.0, retag `scs_02` (governance escalation topology) as a co-contributor to `trust_debt` *or* introduce a new `multiple_choice` on grievance-resolution topology.

---

## 5. Enforcement

[`confidenceGenerationCoverage.test.ts`](../../../apps/union-eyes/lib/icra/__tests__/signal-integrity/confidenceGenerationCoverage.test.ts) asserts:

- Every dimension has ≥ 5 questions feeding `score`.
- Every dimension has ≥ 1 confidence-sensitive (`likert_5`) input.
- ≥ 50 % of scored bank classified Strong.
- Zero cosmetic items.
- `trust_debt` reaches modality-diversity = 3 (currently failing; tracked).
