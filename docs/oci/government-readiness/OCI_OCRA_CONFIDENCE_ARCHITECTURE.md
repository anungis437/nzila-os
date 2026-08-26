# OCI / OCRA Confidence Architecture

> **Status:** Blueprint — Architecture Review Only (no implementation)
> **Audience:** Auditors, statisticians, methodology reviewers, procurement evaluators
> **Existing asset:** `@nzila/oci-confidence` (Universal Confidence Envelope)

---

## 1. Premise: a confidence model already exists — validate, do not reinvent

The brief asks for a confidence model but warns: *do not assume the proposed
formula is correct.* The correct starting point is that OCI/OCRA **already ships
a deterministic confidence model** in `@nzila/oci-confidence`
(`confidence-model.ts`). This document (a) documents what exists, (b) tests it
against the government requirement, and (c) recommends the **minimum** changes —
not a greenfield formula.

---

## 2. What exists today (verified)

`buildConfidenceEnvelope(score, inputs, options)` composes a
`ConfidenceEnvelope` from these factors:

| Factor | Source field | Banding logic |
| --- | --- | --- |
| Sample size | `sampleSize` | `≥10 HIGH`, `≥5 MODERATE`, `>0 LOW`, `≤0 INSUFFICIENT` |
| Data completeness | `dataCompleteness` (0–1) | `≥0.85 HIGH`, `≥0.6 MODERATE`, `>0 LOW`, `0 INSUFFICIENT` |
| Stability | `stability` | `VOLATILE→≤LOW`, `TRANSITIONAL→≤MODERATE` |
| Temporal decay | `assessmentAgeDays` | `<90 NONE`, `90–179 MILD`, `180–364 MODERATE`, `≥365 SEVERE` |
| Reviewer variance | `reviewerVariance` (0–1) | `≥0.4 → ≤LOW` |
| Governance evidence | `governanceEvidencePresent` | `false → ≤LOW` |

**Composition rule:** the envelope takes the **lower** of all contributing bands
(`lower(a,b)`), then applies decay (`applyDecay`). Output states:
`HIGH | MODERATE | LOW | INSUFFICIENT`. It emits **cautions**
(`SMALL_SAMPLE`, `INCOMPLETE_VISIBILITY`, `TRANSITIONAL_INSTABILITY`,
`HIGH_VARIANCE`, `LIMITED_GOVERNANCE_EVIDENCE`, decay caution) and a plain-language
**rationale** array.

**Design virtues (keep these):**

- **Deterministic.** No randomness, no probability claims.
- **Conservative.** "Take the lower band" means confidence is dragged down by the
  weakest factor — the correct posture for public-sector defensibility.
- **Explainable.** Every envelope carries a human-readable rationale.
- **No false precision.** Four ordinal states, not a spurious 0–100 confidence %.

---

## 3. The government requirement vs. the existing model

The brief lists five factors a confidence model designed for public-sector
scrutiny should consider: **evidence strength, completeness, consistency, source
reliability, corroboration.** Mapping these to what exists:

| Required factor | Covered today? | By what |
| --- | --- | --- |
| Evidence strength | **Partially** | Not yet wired into the envelope; the 6-level evidence ladder exists separately |
| Completeness | **Yes** | `dataCompleteness` band |
| Consistency | **Yes** | `reviewerVariance` + `stability` |
| Source reliability | **Partially** | `governanceEvidencePresent` is a blunt proxy |
| Corroboration | **Partially** | Implicit in evidence ladder's `CROSS_VALIDATED`, not in envelope |

**Conclusion:** the envelope is structurally sound but **does not yet ingest the
evidence ladder.** The single highest-value improvement is to feed
evidence-strength into confidence — *not* to invent a new formula.

---

## 4. Recommended evolution (minimal, additive)

### 4.1 Wire evidence strength into the envelope

Add an **evidence band** derived from the existing `EvidenceLevel` ladder:

| Evidence level | Proposed band contribution |
| --- | --- |
| `CROSS_VALIDATED` | HIGH |
| `VERIFIED` | HIGH |
| `OPERATIONAL` | MODERATE |
| `DOCUMENTED` | MODERATE |
| `VERBAL` | LOW |
| `NONE` | INSUFFICIENT |

This band joins the existing `lower(...)` composition. Because the model already
takes the **lowest** band, adding evidence can only **tighten** confidence — it
can never inflate it. This is safe by construction.

### 4.2 Distinguish "source reliability" from "governance evidence present"

Replace the single boolean proxy with an evidence-derived `reviewerCredit` signal
(`none/oral/documentary/operational/audit/independent_audit` already exists in
`evidenceTaxonomy.ts`). Map `independent_audit`/`audit` → no penalty;
`oral`/`none` → LOW cap. This is a refinement of an existing field, not a new
input surface.

### 4.3 Make corroboration explicit

Surface a `corroborated` signal when ≥2 independent evidence items support a
finding (i.e., evidence level reaches `CROSS_VALIDATED`). Corroboration does not
*raise* confidence above other caps (still bounded by the lowest band) but
**removes** the `INCOMPLETE_VISIBILITY` caution when satisfied.

### 4.4 Per-finding envelopes, not just per-assessment

Today the envelope wraps an assessment-level score. Government traceability
requires a **confidence envelope per Finding** (see
[traceability architecture](./OCI_OCRA_POLICY_TRACEABILITY_ARCHITECTURE.md)). The
same `buildConfidenceEnvelope` is reused at finding granularity — no new model.

---

## 5. Proposed confidence composition (formal, validated)

Let a finding's confidence band be:

$$
C_{\text{final}} = \text{decay}\Big(\min\big(B_{\text{sample}},\, B_{\text{complete}},\, B_{\text{evidence}},\, B_{\text{stability}},\, B_{\text{variance}},\, B_{\text{source}}\big)\Big)
$$

where each $B \in \{\text{HIGH}=3, \text{MODERATE}=2, \text{LOW}=1, \text{INSUFFICIENT}=0\}$ and
$\text{decay}(\cdot)$ can only lower the band.

**Why `min` and not a weighted average?**

- A weighted average lets a strong factor *mask* a fatal weakness (e.g., high
  sample size hiding zero evidence). Public-sector defensibility requires the
  **opposite**: the weakest link governs. `min` is the conservative, auditable
  choice and is what the system already does.
- A weighted average also implies a *precision* the inputs do not possess
  (ordinal bands cannot be meaningfully averaged into a continuous score without
  manufacturing false confidence).

**This validates the existing design choice and rejects the intuitive
"weighted-confidence-score" formula** the brief warned against assuming.

---

## 6. What confidence must NEVER do

1. **Never alter the score.** Confidence is *about* a score; it is not *part of*
   it. The composite is computed by the frozen core regardless of confidence.
2. **Never become a probability.** No "87% confident" claims. Ordinal bands only.
3. **Never inflate.** Composition is monotone-decreasing in weakness; no factor
   can raise confidence above the weakest band.
4. **Never hide its reasoning.** Every envelope ships a rationale array.

---

## 7. Decay & re-assessment policy (government framing)

The decay bands map directly to a procurement-friendly re-assessment cadence:

| Age | Decay | Caution | Government reading |
| --- | --- | --- | --- |
| < 90d | NONE | — | Current |
| 90–179d | MILD | aging | Still decision-usable, note age |
| 180–364d | MODERATE | stale | Corroborate before relying |
| ≥ 365d | SEVERE→INSUFFICIENT | expired | Re-assess before relying |

This gives a defensible answer to "how fresh is this finding?" — a standard audit
question.

---

## 8. Summary of recommendations

| Recommendation | Type | Touches score? |
| --- | --- | --- |
| Keep `min`-band composition | Validate existing | No |
| Wire evidence ladder into envelope | Additive input | No |
| Replace governance-boolean with `reviewerCredit` | Refinement | No |
| Add explicit corroboration signal | Additive | No |
| Compute per-finding envelopes | Reuse at finer grain | No |
| Keep ordinal bands (reject % confidence) | Validate existing | No |

> The confidence model is already the right *shape*. Government readiness needs it
> **fed by evidence strength and surfaced per finding** — not redesigned.
