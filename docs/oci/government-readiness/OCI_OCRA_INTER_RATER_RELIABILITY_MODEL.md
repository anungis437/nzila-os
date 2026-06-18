# OCI / OCRA Inter-Rater Reliability Model

> **Status:** Measurement harness IMPLEMENTED (statistics + study engine + tests);
> empirical study not yet run (no reviewer corps data). The harness is ready;
> coefficients remain "not yet measured" until a real panel exists.
> **Audience:** Methodology reviewers, statisticians, auditors, assessor-program owners
> **Existing hook:** `reviewerVariance` is already a confidence-model input
> **Implementation:**
> [`lib/icra/reliability/interRaterReliability.ts`](../../../apps/union-eyes/lib/icra/reliability/interRaterReliability.ts)
> (pure statistics: Cohen's/Fleiss' κ, weighted κ, ICC(2,1), band agreement) and
> [`lib/icra/reliability/reliabilityStudy.ts`](../../../apps/union-eyes/lib/icra/reliability/reliabilityStudy.ts)
> (study orchestration + procurement-floor verdicts). Tests:
> [`inter-rater-reliability.test.ts`](../../../apps/union-eyes/lib/icra/__tests__/government-readiness/inter-rater-reliability.test.ts).

---

## 1. The reliability question government will ask

OCI/OCRA is **reviewer-led by design** — a human credits evidence and anchors
interpretation. This is a strength (anti-surveillance, contextual judgment) and an
exposure: *"Would a different qualified reviewer reach the same finding?"* If the
answer is "we don't know," the methodology is not procurement-ready. Inter-rater
reliability (IRR) is how we answer it with evidence rather than assertion.

This document defines the IRR **architecture** — anticipatory now, measurable as a
reviewer corps grows. It does not claim IRR has already been measured.

---

## 2. Where subjective interpretation actually enters

Determinism analysis shows the score math is **fully objective** given answers.
Subjectivity enters at three controlled points:

| Point | Subjective act | Reliability risk |
| --- | --- | --- |
| **Evidence crediting** | Reviewer assigns an `EvidenceLevel` (NONE…CROSS_VALIDATED) | Different reviewers credit the same artifact differently |
| **Answer selection** | Reviewer maps an interview response to a normalized answer | Borderline responses mapped to adjacent options |
| **Interpretive framing** | Reviewer selects severity narrative (within `contextualScoreNormalizer` bands) | Tone/severity emphasis varies |

Critically, **two of these do not move the number** (framing is label-only;
evidence crediting affects confidence, not score). Only **answer selection** feeds
the deterministic score. This narrows the IRR surface dramatically and is the key
fairness story: *most reviewer subjectivity affects confidence and narrative, not
the composite.*

---

## 3. IRR measurement strategy

### 3.1 What to measure

| Metric | Target construct | Suggested statistic |
| --- | --- | --- |
| **Answer-selection agreement** | Do reviewers pick the same normalized answer? | Cohen's/Fleiss' κ per question |
| **Evidence-level agreement** | Do reviewers assign the same evidence level? | Weighted κ (ordinal) |
| **Composite agreement** | Do independent scorings converge? | ICC (intraclass correlation) on composite |
| **Band agreement** | Same maturity band? | % exact + % within-one-band |
| **Confidence agreement** | Same confidence band? | weighted κ |

### 3.2 Acceptance thresholds (proposed, to be empirically confirmed)

- Composite ICC ≥ **0.80** (good agreement) as a procurement floor.
- Maturity band exact agreement ≥ **70%**, within-one-band ≥ **95%**.
- Evidence-level weighted κ ≥ **0.6** (substantial).

These are **targets to validate**, not claims of current attainment. The honesty
posture (cf. coefficient registry) is preserved.

### 3.3 Study design

- **Paired blind re-assessment:** ≥2 trained reviewers independently assess the
  same (consented, anonymized) institution from the same evidence pack.
- **Calibration set:** a fixed library of standardized evidence vignettes with
  reference answers, used for both measurement and training.
- **Periodic re-measurement:** IRR is re-run as the reviewer corps and question
  bank evolve (version-pinned).

---

## 4. Reducing reviewer variance (calibration architecture)

### 4.1 Assessor training & certification

- Structured curriculum on the evidence ladder, answer mapping, and the
  anti-surveillance boundaries.
- **Certification gate:** a reviewer must reach target agreement against the
  calibration set before scoring live assessments.
- **Recertification** on a cadence and on major question-bank/taxonomy versions.

### 4.2 Structural variance reducers already present

- **Deterministic scoring** removes variance *after* answer selection.
- **Evidence taxonomy** with explicit `reviewerCredit` classes constrains
  crediting.
- **Routing explainability snapshot** + **scoring trace** make any two
  assessments structurally comparable.
- **`contextualScoreNormalizer`** bounds interpretive framing to fixed severity
  bands (a reviewer cannot invent a severity outside the band table).

### 4.3 Feeding IRR back into confidence

The confidence model **already** accepts `reviewerVariance` and caps confidence at
`LOW` when variance ≥ 0.4. The IRR program operationalizes this: measured
disagreement on a finding **lowers that finding's confidence** — closing the loop
between reliability and reported certainty. High variance never silently inflates;
it surfaces as reduced confidence + a `HIGH_VARIANCE` caution.

---

## 5. Governance of the IRR program

- **Version-pinned studies:** every IRR result records reviewer cohort, question
  bank version, taxonomy version, and calibration-set version.
- **No reviewer identification in outputs:** IRR statistics are aggregate; no
  individual reviewer is exposed in institutional reports.
- **Published methodology, honest limits:** the IRR methodology and current
  attainment (including "not yet measured" where true) are disclosed to
  procurement — partial reliability honestly stated beats reliability asserted.

---

## 6. Future validation methodology (roadmap, not a claim)

1. **Phase A — Instrument.** Persist per-finding reviewer attribution
   (anonymized) and the calibration-set scaffolding. *(architecture only here)*
2. **Phase B — Pilot IRR study.** ≥2 reviewers × ≥20 institutions; compute κ/ICC.
3. **Phase C — Calibrate.** Train to threshold; re-measure; certify.
4. **Phase D — Continuous IRR.** Sampled double-scoring in production; feed
   variance into confidence; publish periodic reliability statements.

### 6.1 What the implemented harness already does

The measurement engine is now built and tested (it is not yet *fed* a real
reviewer corps — that is the data gap, not a code gap):

- **Estimators** (`interRaterReliability.ts`, domain-free, no scoring import):
  Cohen's κ (2 raters), Fleiss' κ (≥3 raters), weighted κ (linear/quadratic,
  ordinal evidence ladder), ICC(2,1) two-way-random absolute agreement on the
  composite, and band agreement (exact + within-one). Every estimator returns
  `null` on degenerate/insufficient data — **honesty over coverage**; it will
  never emit a fabricated coefficient.
- **Study orchestration** (`reliabilityStudy.ts`): version-pinned
  (`RELIABILITY_STUDY_VERSION`), applies the §3.2 thresholds, and emits a per-metric
  `Verdict` of `meets` / `below` / `insufficient`. A panel below `MIN_RATERS`,
  `MIN_SUBJECTS_FOR_ICC`, or `MIN_ITEMS_FOR_CLAIM` (20) yields `insufficient` —
  never a false "meets". Reviewer ids are opaque (no reviewer identification in
  outputs, per §5).
- **Closed confidence loop:** the study maps measured per-item disagreement to a
  `reviewerVariance` in `[0,1]`, which flows into `buildFindingConfidence` and caps
  confidence at `LOW` + `HIGH_VARIANCE` once variance ≥ 0.4 (tested end-to-end).

What remains is **data, not code**: run ≥2 reviewers × ≥20 institutions, feed the
ratings into `runReliabilityStudy`, and publish the resulting (honest) verdicts.

---

## 7. What must NOT change

- IRR must **never** make the model less reviewer-led in spirit (no silent
  automation of judgment to "fix" reliability — that would breach the AI
  boundary). Reliability is improved by **training and calibration**, not by
  removing the human.
- IRR statistics **never** alter a historical score; they contextualize confidence
  and inform training.

---

## 8. Executive framing

> OCI/OCRA is reviewer-led, so the fair question is whether two qualified
> reviewers agree. We answer it the way a serious methodology must: by measuring
> agreement (κ on answers and evidence, ICC on the composite), training reviewers
> against a calibration set until they meet a threshold, and **feeding any residual
> disagreement back into reduced confidence** rather than hiding it. Most reviewer
> judgment affects confidence and narrative, not the score itself — which is why
> the composite is already highly reproducible. The IRR program turns that
> structural advantage into measured, published evidence.
