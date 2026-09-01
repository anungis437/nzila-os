# OCI Confidence Interpretation Guide

DOCTRINE_VERSION: 1.0.0

> Confidence is a **categorical posture**, not a probability. This guide translates the four states and six caution states into executive language.

## The four confidence states

| State | What it asserts | What it does NOT assert |
|---|---|---|
| `HIGH` | Sample, completeness, stability, recency, reviewer variance, and governance evidence all clear methodology thresholds. | That the underlying reading is "true" in a probabilistic sense. |
| `MODERATE` | One or two thresholds are below `HIGH` but the reading is still interpretable. | That the reading is half-reliable. |
| `LOW` | The reading is reportable but should be relied on only with reviewer-led contextualisation. | That the institution is performing poorly. |
| `INSUFFICIENT` | The methodology refuses to interpret. | That the institution is at fault. |

## The six caution states

| Caution | Posture sentence (calm, reviewer-safe) |
|---|---|
| `SMALL_SAMPLE` | Sample size is below the methodology threshold; treat this reading as provisional pending broader institutional input. |
| `INCOMPLETE_VISIBILITY` | Expected evidence categories are incomplete; the reading reflects only what was visible to the reviewer. |
| `HIGH_VARIANCE` | Reviewer interpretation showed elevated variance; classification is held with reduced confidence pending reconciliation. |
| `TRANSITIONAL_INSTABILITY` | The institution is mid-transition; readings taken in transition windows are temporally unstable by design. |
| `OUTDATED_ASSESSMENT` | The underlying assessment is older than the methodology recommends; refresh the inputs before relying on the classification. |
| `LIMITED_GOVERNANCE_EVIDENCE` | Governance evidence was not present at the threshold the methodology requires; classification is structural rather than evidentiary. |

## Reading confidence alongside a band

Always combine the band and the envelope:

> *Stewardship Density Index: **CONCENTRATED** (confidence: MODERATE, sample 12, completeness 0.78, decay MILD, cautions: INCOMPLETE_VISIBILITY).*

This sentence is **interpretable** by an auditor. A sentence that says "SDI is CONCENTRATED" without an envelope is **not OCI-compliant**.

## When confidence and band disagree

A `HIGHLY_CONCENTRATED` band with `INSUFFICIENT` confidence is a **request for reviewer re-examination**, not a finding.

A `DISTRIBUTED` band with `INSUFFICIENT` confidence is **also** a request for re-examination — favourable bands at low confidence are not licence to relax.

See also: [`OCI_AUDITOR_QUICK_REFERENCE.md`](OCI_AUDITOR_QUICK_REFERENCE.md), [`OCI_GOVERNANCE_ENTROPY_REVIEW_GUIDE.md`](OCI_GOVERNANCE_ENTROPY_REVIEW_GUIDE.md).
