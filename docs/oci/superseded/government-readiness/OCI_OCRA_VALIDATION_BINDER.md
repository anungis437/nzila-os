# OCI / OCRA Validation Binder

> **Status:** Assembled evidence index — one artifact, every validation thread.
> **Audience:** Deputy ministers, Crown corporation boards, Auditors General,
> regulators, procurement evaluators, and the external validator (Richard Sharpe).
> **Purpose:** A single, navigable binder that gathers — in one place — every
> claim OCI/OCRA makes about itself **and the executable evidence that backs it.**
> Government bodies procure programs they can defend; this is the defence file.
> **Doctrine version:** 1.0.0

---

## 0. How to read this binder

Each section states a **claim**, the **evidence** that proves it (a specification
document and the executable test suite that enforces it), and the **honest limit**
of that claim. Nothing here is asserted without either a test or an explicit
"not yet measured" caveat. Where a property is enforced by code, the binder links
the **test suite** so a skeptical reviewer can run it.

> **Constitutional frame.** Everything validated below sits over a **frozen
> scoring core**. The additive government-readiness layer is read-only: it never
> changes a dimension, composite, or maturity band. See the
> [Architecture Decision](GOVERNMENT_READINESS_ARCHITECTURE_DECISION.md).

---

## 1. Validation matrix (the one-page view)

| # | Claim | Specification | Executable evidence | Honest limit |
| --- | --- | --- | --- | --- |
| V1 | **Complexity** is modelled and discriminated across the institutional ladder | [Master Blueprint](OCI_OCRA_GOVERNMENT_READINESS_MASTER_BLUEPRINT.md) | `adaptation/__tests__/worldClassComplexityValidation.test.ts` | Coefficients are practitioner-informed (v1.0.0), not empirically calibrated |
| V2 | **Fairness** — context alters *interpretation labels only*, never the number | [Architecture Decision §1.2](GOVERNMENT_READINESS_ARCHITECTURE_DECISION.md) | adaptation suites; backward-compat score invariance | — |
| V3 | **Determinism** — identical inputs yield identical outputs | [Explainability Model §3](OCI_OCRA_EXPLAINABILITY_MODEL.md) | `__tests__/personaDeterminism.test.ts`; `government-readiness/backward-compat-scores.test.ts` | — |
| V4 | **Non-regression** — the additive layer cannot move a score | [Non-Regression Spec](implementation/NON_REGRESSION_TEST_SPECIFICATION.md) | `government-readiness/` suite (10 files) | — |
| V5 | **Benchmark governance** — cohort floors, no rankings, honesty clause | [Benchmark Governance](OCI_OCRA_BENCHMARK_GOVERNANCE_REVIEW.md) | `lib/oci/benchmark/__tests__/publicationGuard.test.ts` | Baselines characteristic, not normative |
| V6 | **Confidence** — evidence-fed, ordinal, never inflated | [Confidence Architecture](OCI_OCRA_CONFIDENCE_ARCHITECTURE.md) | `government-readiness/confidence-evidence-floor.test.ts` | — |
| V7 | **Inter-rater reliability** — agreement is measurable (κ/ICC/band) | [IRR Model](OCI_OCRA_INTER_RATER_RELIABILITY_MODEL.md) | `government-readiness/inter-rater-reliability.test.ts` | Harness built; **empirical study pending real reviewer corps** |
| V8 | **Source-instrument traceability** — findings trace to a candidate source-instrument record | [Source Instrument Traceability](OCI_OCRA_SOURCE_INSTRUMENT_TRACEABILITY.md) | `government-readiness/source-instrument-traceability.test.ts`; `…/source-instrument-authority.test.ts` | Seed catalogue **UNVERIFIED**; no citation defensible until validated |
| V9 | **Catalogue governance** — who decides which legislation counts | [Source Instrument Traceability §6a](OCI_OCRA_SOURCE_INSTRUMENT_TRACEABILITY.md) | `government-readiness/catalogue-governance.test.ts` | — |
| V10 | **Assessor governance** — who may conduct OCI/OCRA, and stay current | [Assessor Certification Standard](OCI_OCRA_ASSESSOR_CERTIFICATION_STANDARD.md) | `government-readiness/assessor-governance.test.ts` | Levels/cadence are policy; real certifications pending corps |
| V11 | **Security & data handling** — collected/not, residency, retention, AI boundary | [Security Brief](SECURITY_AND_DATA_HANDLING_BRIEF.md) | k-anonymity K=5 enforced in `lib/oci/benchmark/aggregateIntelligence.ts` | — |
| V12 | **Procurement defensibility** — five archetypes, gaps, roadmap | [Procurement Readiness](OCI_OCRA_PROCUREMENT_READINESS_ASSESSMENT.md) | this binder + the suites above | Regulator 9.5/10 pending real-world IRR data |

---

## 2. The validation threads in full

### V1 — Complexity validation
OCI/OCRA adapts to institutional complexity (scale, governance density, continuity
exposure) **without** forking the score. The complexity ladder is discriminated
with deterministic routing fingerprints, proving the adaptation is real and
reproducible rather than cosmetic. Evidence:
`worldClassComplexityValidation.test.ts` (*"discriminates routing value across the
complexity ladder with deterministic fingerprints"*).

### V2 — Fairness validation
The fairness rule is **structural**: context changes *which questions are asked*
and *how a result is narrated*, never the arithmetic. Two institutions with the
same answers get the same number regardless of sector. This is what makes the
0–100 scale comparable and the benchmark layer honest.

### V3 — Determinism validation
Scoring is a pure function of answers; persona and narration are label-only.
`personaDeterminism.test.ts` proves switching persona never changes the underlying
result; `backward-compat-scores.test.ts` proves running the additive layer twice
yields identical findings.

### V4 — Non-regression validation
The five founding invariants — scores unchanged, obligation isolation,
seven-answer completeness, no orphan recommendations, confidence floor — plus the
Phase C/G/Gap suites are all enforced in the **`government-readiness/`** test
directory (10 files). Every suite includes a "run twice, identical output"
determinism assertion and an import-graph check that the layer never imports
nothing it shouldn't.

### V5 — Benchmark governance validation
`guardBenchmarkClaim` is suppress-by-default: it enforces cohort minimums
(K ≥ 5, N ≥ 20 per sector, ≥ 3 trend periods), rejects forbidden claim forms
(ranking, normative grade, probability), and requires the honesty clause on every
published statement. Proven by `publicationGuard.test.ts`.

### V6 — Confidence validation
Confidence is an **ordinal** envelope fed by evidence strength; the evidence band
is the governing cap and high reviewer variance lowers (never raises) confidence.
No percentages are emitted. Proven by `confidence-evidence-floor.test.ts`.

### V7 — Inter-rater reliability
The harness computes Cohen's/Fleiss' κ on answers, weighted κ on evidence, ICC on
the composite, and band agreement — each judged against proposed procurement
thresholds with an honest `INSUFFICIENT` verdict when the panel is too small.
**Honest limit:** the *machinery* is validated; the *measurement* awaits a real
reviewer corps. No coefficient is asserted.

### V8 — Source-instrument traceability
Findings trace from an obligation **class** to a **specific instrument** and a
gated **citation** carrying `authorityLevel` and `effectiveDate`. The seed
catalogue is wholly `UNVERIFIED` with null clause references and effective dates —
**the system asserts no law it has not earned the right to assert.**

### V9 — Catalogue governance
A lifecycle state machine, role-gated versioned amendments, jurisdiction
selection, and authority-led conflict handling answer *"who decides which
legislation counts?"* Nothing is silently deleted; ties at the top authority
escalate to human arbitration.

### V10 — Assessor governance
A five-level competency standard with a calibration gate (reusing the IRR
thresholds), annual recertification, minimum sampled reviews, and suspend-by-
default conditions converts "reviewer-led" into **governed reviewer-led.**

### V11 — Security & data handling
The [Security Brief](SECURITY_AND_DATA_HANDLING_BRIEF.md) states exactly what is
and is not collected, residency, retention, access controls, k-anonymity (K=5),
the AI boundary, and withdrawal/export/deletion — with k-anonymity enforced in
code at the aggregation boundary.

### V12 — Procurement defensibility
The [Procurement Readiness Assessment](OCI_OCRA_PROCUREMENT_READINESS_ASSESSMENT.md)
walks five public-sector archetypes (government advisory, municipal, pilot, Crown
corporation, regulator) against the evidence above.

---

## 3. Open limits (what this binder does **not** yet establish)

> **Authoritative status matrix:** [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).
> Where any wording below drifts from that matrix, the matrix wins.

The principal architecture components are implemented and internally tested.
The binder is deliberately **not** claiming that "every gap is closed" — the
following operational, empirical, legal, and external-validation gaps remain
open and must be closed before OCI/OCRA can be positioned as procurement-ready
in a regulated public-sector context:

1. **No empirically-measured inter-rater reliability.** The harness is
   `INTERNALLY_TESTED`; no κ, ICC, or band-agreement value has been observed
   against a real reviewer panel (G9).
2. **No verified legal-instrument catalogue.** The seed catalogue is entirely
   `UNVERIFIED`; no citation is defensible until real instruments,
   jurisdictions, dates, clauses, and applicability logic are populated and
   confirmed by qualified counsel (G7).
3. **No certified assessor corps.** Zero certified assessors exist today; the
   assessor governance standard is `PROPOSED`, not operational (G8).
4. **No external security-control evidence.** Encryption, key management,
   tenant isolation, MFA, SIEM retention, backup/restoration, incident
   response, and residency are `PROPOSED` per-engagement, not independently
   attested (S6–S13).
5. **Free-text `Answer.note` is not PII-safe.** The scoring/finding/trace
   *derived* structures exclude direct personal identifiers by schema, but the
   source `Answer` still carries an optional free-text `note` field that can
   contain personal, confidential, or protected content. This must be
   reconciled with the security brief (S5).
6. **No executed pilot.** Two priority archetypes are named (P1); no concrete
   pilot has been scoped or run (P2).
7. **No commercial/legal packet.** Liability, insurance, IP ownership, audit
   rights, service levels, exit support, subprocessor register, appeal
   mechanism, records-management, conflict-of-interest controls, and Indigenous
   data-sovereignty posture are all `PROPOSED` (L1–L9).
8. **No externally validated architecture review.** The OCI/OCRA
   government-readiness architecture has **not** been reviewed by a party
   independent of Nzila. The document historically titled *"Government
   Validation Report V1"* has been renamed
   [INTERNAL_PRE_MORTEM_HYPOTHETICAL_REVIEWER_CHALLENGES.md](INTERNAL_PRE_MORTEM_HYPOTHETICAL_REVIEWER_CHALLENGES.md)
   to clarify that it is an internal red-team pre-mortem — not an external
   validation.

Any single one of items 2, 3, 4, 6, or 8 is sufficient to preclude a
*"procurement-grade"* claim. In combination, they define the honest current
disposition:

> **Candidate for structured public-sector validation.** The architecture is
> designed for public-sector scrutiny and is entering external review; it is
> not yet procurement-grade, government-grade, or defensible for autonomous
> institutional action.

The prior wording that framed IRR and external validation as *"the single
remaining limit"* has been retired.

---

## 4. Binder contents (printable order)

1. [Master Blueprint](OCI_OCRA_GOVERNMENT_READINESS_MASTER_BLUEPRINT.md)
2. **This Validation Binder**
3. [Security & Data-Handling Brief](SECURITY_AND_DATA_HANDLING_BRIEF.md)
4. [Assessor Certification & Governance Standard](OCI_OCRA_ASSESSOR_CERTIFICATION_STANDARD.md)
5. [Source Instrument Traceability Standard](OCI_OCRA_SOURCE_INSTRUMENT_TRACEABILITY.md)
6. [Inter-Rater Reliability Model](OCI_OCRA_INTER_RATER_RELIABILITY_MODEL.md)
7. [Benchmark Governance Review](OCI_OCRA_BENCHMARK_GOVERNANCE_REVIEW.md)
8. [Confidence Architecture](OCI_OCRA_CONFIDENCE_ARCHITECTURE.md)
9. [Explainability Model](OCI_OCRA_EXPLAINABILITY_MODEL.md)
10. [Obligation Taxonomy](OCI_OCRA_OBLIGATION_TAXONOMY.md) · [Consequence Model](OCI_OCRA_CONSEQUENCE_MODEL.md)
11. [Procurement Readiness Assessment](OCI_OCRA_PROCUREMENT_READINESS_ASSESSMENT.md)
12. [Non-Regression Test Specification](implementation/NON_REGRESSION_TEST_SPECIFICATION.md)
13. [Richard Validation Packet](richard-packet/RICHARD_VALIDATION_PACKET.md) · [Validation Workbook](richard-packet/VALIDATION_WORKBOOK.md)

> With these in hand, an external reviewer is looking at a **candidate
> assessment program under structured public-sector validation** — with an
> explicit register of what is implemented, what is internally tested, and
> what remains to be measured, attested, or piloted (see
> [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)). It is not yet a
> program a Crown corporation, ministry, regulator, or municipality can
> procure and defend without those open items closing first.
