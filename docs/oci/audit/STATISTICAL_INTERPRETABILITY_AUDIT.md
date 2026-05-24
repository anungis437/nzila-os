# Statistical Interpretability Audit™

ARTIFACT_TYPE: Question Architecture Audit™ — Part 7
DOCTRINE_VERSION: 1.1.0
AUDIT_VERSION: 1.0.0
GROUND_TRUTH: [QUESTION_ARCHITECTURE_INVENTORY.md](./QUESTION_ARCHITECTURE_INVENTORY.md)
INPUT_TO: HHI / Gini / variance contextualization in [apps/union-eyes/lib/oci/statistics/](../../../apps/union-eyes/lib/oci/statistics/)

> **Audit question.** Does the question pool support the statistical interpretation it is asked to support, or does it invite pseudo-precision, false certainty, ordinal overreach, and mathematical fragility?

---

## 1. Statistical role classification

| Role | Definition |
|---|---|
| **S-Ordinal-Safe** | Five-level ladder where order is meaningful and **rank-based** statistics are valid (medians, IQR, Spearman) but interval arithmetic is **not** safe. |
| **S-Interval-Eligible** | Likert-5 confidence statement where interval treatment is conventionally tolerated for trend/variance computation, **with explicit caveats**. |
| **S-Categorical** | Multiple-choice topology where statistical use is restricted to **frequency distribution** and **concentration measures** (HHI, Gini-of-options). |
| **S-Nominal** | Metadata categorical with no ordering. |

---

## 2. Per-modality treatment

| Modality | Statistical role | Permitted statistics | Forbidden statistics |
|---|---|---|---|
| `maturity_select` | S-Ordinal-Safe | median, IQR, Spearman ρ, ordinal logistic regression, distribution shape | mean, σ, Pearson r, parametric tests on raw scores |
| `likert_5` | S-Interval-Eligible | mean (with σ + sample size disclosed), σ, Pearson r, paired-difference for trend | mean without σ + n, single-period mean treated as fact |
| `multiple_choice` | S-Categorical | frequency, HHI (option concentration), Gini, χ² for cross-tabulation | mean, σ, ordinal arithmetic |
| `select` / `text` (metadata) | S-Nominal / not-statistical | frequency, stratification only | any inferential treatment |

The scored composite uses a **weighted ordinal-rank construct** (not an arithmetic mean of raw values) — this is the only statistically defensible composite for a mixed-modality bank. Verified in `maturityProgression.test.ts`.

---

## 3. Pseudo-precision risk audit

Pseudo-precision = reporting a value at a precision greater than the input granularity supports.

| Risk source | Present? | Mitigation |
|---|:--:|---|
| Reporting a composite score to 2 decimal places (input granularity = 1-of-5) | ⚠️ (technically possible) | Confidence visual model rounds to nearest 5; raw composite reported with explicit `± confidence band` |
| Reporting a percentile rank against an unverified reference cohort | ❌ | No external percentile reporting; only intra-institution longitudinal |
| Reporting HHI to 4 decimals when N < 10 | ❌ | HHI engine truncates and emits sampleSize-bound caveat |
| Reporting confidence as a probability | ❌ | Confidence is rendered as an envelope band, not a probability |

**Finding S-1 (Pass).** No pseudo-precision risk path exists in the public envelope.

---

## 4. False certainty risk audit

False certainty = presenting a derived value without the uncertainty it carries.

| Risk | Present? | Mitigation |
|---|:--:|---|
| Composite score shown without confidence | ❌ | `confidenceVisualModel` requires confidence rendering alongside score |
| GES ordinal shown without `cautionState` | ❌ | escalation rules require caution disclosure |
| HHI / Gini shown without sample size disclosure | ❌ | statisticalAnchorContracts forces sampleSize co-emission |
| Trend delta shown without sigma | ⚠️ pending longitudinal store | resolved with v1.3.0 |

**Finding S-2 (Pass, conditional).** No false-certainty path in current envelope. Pending longitudinal store, trend delta must always be reported with σ.

---

## 5. Ordinal overreach audit

Ordinal overreach = treating a 1-of-5 ladder position as a continuous interval value.

| Question | Used arithmetically? | Treatment |
|---|---|---|
| All 42 `maturity_select` | dimension-weighted ordinal aggregation, **not** arithmetic mean | OK |
| Composite across sections | weighted ordinal-rank composite | OK |
| `likert_5` × 7 | mean used **with σ + n** in stability-engine | OK |

**Finding S-3 (Pass).** Ordinal overreach is structurally prevented by the dimension-weighting design.

---

## 6. Mathematically weak prompts

Definition: a prompt whose response distribution does not vary enough to carry statistical signal (e.g., 95 % of respondents click the same option).

The bank does not yet have sufficient response volume to empirically classify any prompt as mathematically weak. The **structural** check below is the substitute:

| Structural weakness | Present? |
|---|:--:|
| Prompt whose 5 options are not differentiable in plain language | ❌ |
| Prompt whose maturity ladder collapses to "yes/no" in practice | ❌ |
| Prompt whose `multiple_choice` options are not mutually exclusive | ❌ |
| Prompt whose `likert_5` statement is double-barrelled | ❌ |

**Finding S-4 (Pass).** No structurally weak prompts identified. Once response volume is sufficient, an empirical pass shall be added to the v1.3.0 audit cycle.

---

## 7. HHI / Gini support

The bank supports HHI and Gini interpretation at the following granularity:

| Use | Inputs | Support |
|---|---|---|
| HHI on stewardship concentration (per role / per dimension) | `od_01..05`, `scs_01`, `scs_03` + facilitation evidence | ✅ |
| Gini on burden distribution | `icb_01`, `icb_02`, `cf_01`, `scs_03` | ✅ (4 items — minimal but sufficient) |
| HHI on governance authority concentration | `gv_03`, `scs_02` | ⚠️ (2 items — at floor) |
| Gini on documentation discipline distribution | `gv_01`, `gv_02`, `gv_04`, `oc_02`, `im_01` | ✅ |

**Finding S-5 (Medium).** HHI on governance authority concentration rests on 2 items. Disposition: add 1 `multiple_choice` topology probe on governance authority distribution in v1.2.0.

---

## 8. Bounded confidence logic

Every emitted score is bounded by:
- `dataCompleteness ≥ 0.6` floor (otherwise envelope emits `cautionState = "insufficient_data"`)
- `sampleSize ≥ 5` per dimension (otherwise per-dimension confidence capped at 0.6)
- `reviewerVariance` cap on entropy ordinal escalation

These are enforced in [`confidence-model.ts`](../../../packages/oci-confidence/src/confidence-model.ts) and verified in the `@nzila/oci-confidence` test suite.

---

## 9. Enforcement

[`statisticalInterpretability.test.ts`](../../../apps/union-eyes/lib/icra/__tests__/signal-integrity/statisticalInterpretability.test.ts) asserts:

- Every `maturity_select` is treated as ordinal in composite (no arithmetic-mean code path).
- Every `likert_5` reporting path includes σ + n.
- Every HHI / Gini emission carries a `sampleSize` field.
- No composite score is emitted without a `confidence` field.
- Governance-authority HHI has ≥ 3 inputs (currently failing; tracked).
