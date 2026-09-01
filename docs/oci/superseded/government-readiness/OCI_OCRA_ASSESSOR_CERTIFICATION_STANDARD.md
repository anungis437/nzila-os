# OCI / OCRA Assessor Certification & Governance Standard

> **Status:** Implemented — additive, read-only governance layer over the frozen core.
> **Audience:** Regulators, deputy ministers, Crown corporation boards, Auditors
> General, procurement evaluators, and the external validator (Richard Sharpe).
> **Companion to:** [Inter-Rater Reliability Model](OCI_OCRA_INTER_RATER_RELIABILITY_MODEL.md),
> [Security & Data-Handling Brief](SECURITY_AND_DATA_HANDLING_BRIEF.md),
> [Master Blueprint](OCI_OCRA_GOVERNMENT_READINESS_MASTER_BLUEPRINT.md).
> **Doctrine version:** 1.0.0
> **Implementation:**
> [`lib/icra/assessors/assessorGovernance.ts`](../../../../apps/union-eyes/lib/icra/assessors/assessorGovernance.ts).
> Tests: [`assessor-governance.test.ts`](../../../../apps/union-eyes/lib/icra/__tests__/government-readiness/assessor-governance.test.ts).

---

## 0. The question this standard answers

The Inter-Rater Reliability model answers *"would two qualified reviewers agree?"*
A regulator asks the **prior** question:

> **Who is allowed to conduct OCI/OCRA in the first place — and how does that
> authorization stay current?**

OCI/OCRA is reviewer-led by design. Without an assessor standard, "reviewer-led"
is a liability ("anyone can run it"). With one, it becomes **governed
reviewer-led** — a defensible, auditable competency regime. That is the difference
this standard makes.

---

## 1. The five-level assessor standard

| Level | Title | Gate | May score live | Independently | Supervise/sign-off | Certify others | Own calibration set |
| --- | --- | --- | :---: | :---: | :---: | :---: | :---: |
| **1** | Trained | Training complete | — | — | — | — | — |
| **2** | Calibrated | Calibration complete (meets agreement thresholds) | ✓ (supervised) | — | — | — | — |
| **3** | Certified assessor | Calibrated + supervised live reviews signed off | ✓ | ✓ | — | — | — |
| **4** | Senior reviewer | Certified + track record | ✓ | ✓ | ✓ | ✓ | — |
| **5** | Calibration authority | Entrusted to own the calibration set | ✓ | ✓ | ✓ | ✓ | ✓ |

Privileges are **strictly monotonic** by level (enforced in tests). The minimum
level to conduct a live assessment **independently** is **Level 3**.

> **Level 1 holds no certificate.** "Trained, not yet certified" is represented by
> the *absence* of a certification record, not a record — you cannot certify on
> training alone.

---

## 2. The calibration gate (reuses the IRR thresholds — with a stated caveat)

An assessor is certified only after **measured agreement against a versioned
calibration reference set** clears every threshold. Critically, these are the
**same** thresholds the IRR doctrine proposes for the program as a whole — an
individual assessor must reach the agreement bar the program promises
collectively. The constants are imported from the reliability study so the two can
never drift:

| Facet | Threshold | Source |
| --- | --- | --- |
| Answer-selection κ | ≥ **0.60** | `THRESHOLDS.answerKappa` |
| Evidence-level weighted κ | ≥ **0.60** | `THRESHOLDS.evidenceWeightedKappa` |
| Composite ICC | ≥ **0.80** | `THRESHOLDS.compositeIcc` |
| Maturity-band exact agreement | ≥ **0.70** | `THRESHOLDS.bandExact` |

**An unmeasured facet is a shortfall, not a pass.** You cannot certify on
agreement you did not measure (`null` → fails the gate). `evaluateCalibration`
returns every shortfall, never a single pass/fail with no reason.

### 2.1 Methodological caveat — κ, ICC, and Fleiss κ are cohort/system metrics

> **Honest limitation.** Cohen's κ, Fleiss' κ, and the intraclass correlation
> coefficient (ICC) are, in their standard formulations, **inter-rater
> reliability statistics for a rater group or a rater–system pair over a shared
> set of items** — not, on their own, well-defined characterisations of an
> **individual** assessor's competence in isolation. Using program-level κ/ICC
> thresholds as an *individual* certification gate is deliberate (it prevents
> the personal bar from drifting below the program bar), but it is not the
> primary evidence a review body should rely on for individual certification.
>
> Individual certification is therefore additionally evaluated on measurements
> that are meaningful at the person level:
>
> - **Agreement with a gold-standard adjudicated key** on the same reference
>   set (percentage of answers matching adjudicator, banded exact agreement,
>   and confusion patterns).
> - **Critical-error rate** — the rate at which the assessor emits findings
>   the adjudicator would suppress (over-claim), or suppresses findings the
>   adjudicator would surface (under-claim), stratified by obligation class.
> - **False-assertion rate under evidence discipline** — the rate at which
>   the assessor asserts an obligation (especially `Statutory`) below its
>   evidence floor.
> - **Adjudicated review of a stratified live-work sample** by a Level 4/5
>   assessor once independent scoring authority is granted.
>
> The κ/ICC/band-exact numbers above remain gate conditions (an assessor
> **cannot** be certified if their contribution would degrade cohort-level
> κ/ICC below the program bar), but the *primary* individual evidence is the
> gold-standard, critical-error, and false-assertion set. This calibration
> program will publish, alongside any κ/ICC value, the sample size, the
> adjudicator, and the confidence interval, in line with the reliability
> reporting posture in the [IRR Model](OCI_OCRA_INTER_RATER_RELIABILITY_MODEL.md).

---

## 3. Certification validity & recertification cadence

- **Certification is time-bound.** `certifyAssessor` stamps a `validUntil` exactly
  **365 days** (`RECERTIFICATION_CADENCE_DAYS`) after `certifiedOn`. Certification
  is never permanent.
- **Recertification is required** on the annual cadence, **and** whenever the
  **calibration set version advances** past the version the assessor was certified
  against — a material change to the standard invalidates prior calibration.
- **Minimum sample reviews.** An active assessor must complete at least
  **`MIN_SAMPLE_REVIEWS_PER_PERIOD` (4)** double-scored reviews per certification
  period. Below that, there is too little signal to trust continued agreement.

---

## 4. Standing & suspension conditions

`evaluateStanding` computes one of three verdicts, reporting **all** contributing
reasons (no short-circuit), and is pure/deterministic:

| Verdict | Meaning | Live authority |
| --- | --- | --- |
| `in_good_standing` | Active, calibrated, in-window, sufficiently sampled | Held (Level ≥ 3) |
| `recertification_due` | Renewal window open **or** calibration set advanced | **Held** until validity date |
| `suspended` | Any hard failure below | **Revoked** |

**Suspension dominates.** Any one of these revokes live-assessment authority:

1. Certification **revoked** or **suspended**.
2. Certification **expired** (`asOf > validUntil`).
3. **Calibration drift** — a sampled recalibration falls below threshold.
4. **Under-sampling** — fewer than the minimum sampled reviews this period.

A material calibration-set change with no other failure yields
`recertification_due` (authorization holds until the validity date, but renewal is
required) — distinguishing "must renew soon" from "must stop now."

---

## 5. Safety constitution

- **Reference/governance data only.** The module never imports the scoring engine;
  it cannot influence a dimension, composite, or maturity band. (Enforced by an
  import-graph test.)
- **Assessors are opaque ids, never named persons** in any output — consistent
  with the IRR "opaque rater id" rule and the anti-surveillance posture.
- **The calibration bar cannot be silently lowered** — it is imported from the IRR
  thresholds, not re-declared.
- **Authorization is suspend-by-default** on any failed condition. Standing is
  *earned* and must be actively maintained, never assumed.
- **Pure & deterministic.** Same inputs → same standing. Dates are caller-supplied
  (injectable), so evaluations are reproducible for audit.

---

## 6. What this standard does **not** do

- It does **not** automate judgment. Reliability is improved by **training and
  calibration**, not by removing the human (that would breach the AI boundary).
- It does **not** alter any score, historical or current.
- It does **not** name or expose any individual reviewer.
- It does **not** replace the IRR *measurement* — it governs *who may be measured*
  and authorized in the first place. The two are complementary halves of
  governed reviewer-led assessment.

---

## 7. What a regulator can now conclude

> *OCI/OCRA is reviewer-led, but it is not "anyone can run it." There is a
> five-level competency standard; certification requires clearing the same
> agreement thresholds the methodology promises; certificates expire annually and
> on any material change to the calibration standard; assessors must keep being
> sampled; and any drift, lapse, or under-sampling suspends authority by default.
> That is a governable assessor program a public body can defend.*

The remaining gap is **data, not architecture**: real assessors, calibrated
against a real reference set, producing measured agreement over time. This
standard is the governance frame that data plugs into.
