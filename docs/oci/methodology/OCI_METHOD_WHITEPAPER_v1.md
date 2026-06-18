# The OCI Method™ — Methodology Specification

**Status:** Canonical methodology publication
**Doctrine version:** 1.0.0
**Date of first publication:** 2026-05-23
**Document class:** Publication-grade methodology specification
**Maintainers:** OCI doctrine maintainers (recorded in [CODEOWNERS](../../../CODEOWNERS) for `docs/oci/`)

**Intended readers**
- Institutional procurement reviewers evaluating OCI against ISO, COBIT, or comparable standards.
- Governance auditors interpreting OCI's signature framework outputs.
- Academic reviewers assessing the methodology's coherence and honesty.
- Certified facilitators and sponsoring institutions.

**Companion artifacts (machine-readable)**
- [coefficient-registry.yaml](coefficient-registry.yaml)
- [sample-size-policy.yaml](sample-size-policy.yaml)
- [standards-crosswalk.yaml](standards-crosswalk.yaml)
- [sensitivity/scenarios.yaml](sensitivity/scenarios.yaml)
- [observable-criteria/entropy-1.yaml](observable-criteria/entropy-1.yaml) … [entropy-5.yaml](observable-criteria/entropy-5.yaml)
- [METHODOLOGY_CHANGELOG.md](METHODOLOGY_CHANGELOG.md)

**Source implementation**
- [apps/union-eyes/lib/oci/frameworks/](../../../apps/union-eyes/lib/oci/frameworks/)

**Government-readiness & validation layer (additive, read-only over the frozen core)**

These artifacts carry OCI/OCRA's procurement-facing validation evidence. Each is an *additive* layer above the scoring core specified in this document: it is specified in doctrine and implemented as a constitutionally-isolated, read-only module that **never imports the scoring engine** and therefore cannot influence a dimension, composite, or maturity band (enforced by the non-regression and isolation suites). An auditor can reconstruct any procurement claim by following these references.

- [Government-readiness program index](../government-readiness/README.md) — the full additive-layer map and the non-negotiable freeze.
- **Evidence validation binder** — [OCI_OCRA_VALIDATION_BINDER.md](../government-readiness/OCI_OCRA_VALIDATION_BINDER.md): every methodology claim mapped to its specification and to an executable test. Grounded in the evidence-strength ladder ([evidence-strength/evidenceTaxonomy.ts](../../../apps/union-eyes/lib/icra/evidence-strength/evidenceTaxonomy.ts), NONE…CROSS_VALIDATED).
- **Obligation mapping & source-instrument governance** — [OCI_OCRA_OBLIGATION_TAXONOMY.md](../government-readiness/OCI_OCRA_OBLIGATION_TAXONOMY.md) and [OCI_OCRA_SOURCE_INSTRUMENT_TRACEABILITY.md](../government-readiness/OCI_OCRA_SOURCE_INSTRUMENT_TRACEABILITY.md): deterministic finding → obligation → source-instrument → citation mapping with a role-gated catalogue lifecycle (add/retire/version/jurisdiction/conflict). Implemented in [obligations/](../../../apps/union-eyes/lib/icra/obligations/), isolated by `obligation-mapping-isolation.test.ts`.
- **Assessor certification & inter-rater reliability** — [OCI_OCRA_ASSESSOR_CERTIFICATION_STANDARD.md](../government-readiness/OCI_OCRA_ASSESSOR_CERTIFICATION_STANDARD.md) and [OCI_OCRA_INTER_RATER_RELIABILITY_MODEL.md](../government-readiness/OCI_OCRA_INTER_RATER_RELIABILITY_MODEL.md): a five-level, suspend-by-default assessor standard (calibration gate, recertification cadence) plus the κ/ICC/band-agreement harness. Implemented in [assessors/assessorGovernance.ts](../../../apps/union-eyes/lib/icra/assessors/assessorGovernance.ts) and [reliability/](../../../apps/union-eyes/lib/icra/reliability/).
- **Senior-validator protocol & verdicts** — [RICHARD_SHARPE_VALIDATION_PROTOCOL.md](../government-readiness/RICHARD_SHARPE_VALIDATION_PROTOCOL.md) and [GOVERNMENT_VALIDATION_REPORT_V1.md](../government-readiness/GOVERNMENT_VALIDATION_REPORT_V1.md): the adversarial public-sector review protocol and its recorded dispositions.

---

## Table of contents

- [§0 Methodology Maturity Disclosure (read first)](#0-methodology-maturity-disclosure-read-first)
- [§1 Purpose](#1-purpose)
- [§2 Scope and audience](#2-scope-and-audience)
- [§3 Doctrine lineage](#3-doctrine-lineage)
- [§4 Methodology philosophy](#4-methodology-philosophy)
- [§4.5 Methodological Maturity Classification™](#45-methodological-maturity-classification)
- [§4.6 The Construct Invariant™ (single construct, evidence gradient)](#46-the-construct-invariant-single-construct-evidence-gradient)
- [§5 Framework overview](#5-framework-overview)
- [§6 Frameworks in detail](#6-frameworks-in-detail)
- [§7 Confidence model](#7-confidence-model)
- [§8 Observable criteria (reviewer reproducibility)](#8-observable-criteria-reviewer-reproducibility)
- [§9 Workflow integration](#9-workflow-integration)
- [§10 Sensitivity analysis](#10-sensitivity-analysis)
- [§11 Limitations and non-intended uses](#11-limitations-and-non-intended-uses)
- [§11.5 Known methodological risks](#115-known-methodological-risks)
- [§12 Standards positioning](#12-standards-positioning)
- [§13 Doctrine governance](#13-doctrine-governance)
- [§14 Roadmap to v2 (empirical calibration)](#14-roadmap-to-v2-empirical-calibration)
- [§15 AI boundary as applied to the method](#15-ai-boundary-as-applied-to-the-method)
- [§16 Closing](#16-closing)
- [Appendices](#appendices)

---

## §0 Methodology Maturity Disclosure (read first)

This document specifies a methodology whose coefficients, thresholds, and observable criteria are at version 1.0.0. The maturity of the methodology surface is bounded; this section names that boundary plainly.

**What is mature at v1.0.0.** The five signature frameworks (Stewardship Density Index™, Governance Entropy Scale™, Continuity Burden Map™, Continuity Survivability Matrix™, Reconstruction Burden Index™) are structurally stable. Their inputs, outputs, computational shape, and surfacing rules are deterministic and have been reviewed by their stewards. The doctrine surface — the anti-surveillance position, the AI boundary, the privacy position, the data-handling and security postures, the facilitator certification rubric, and the engagement model — is also stable and is the product of multi-year institutional practice.

**What is not yet mature at v1.0.0.** The numeric coefficients used inside the frameworks (the criticality weights, the tenure amplifiers, the band thresholds, the burden-composite weights, the reconstruction-index multipliers) are *practitioner-informed* or *theoretical*, as defined in [§4.5](#45-methodological-maturity-classification). They are not empirically calibrated against an OCI-held longitudinal dataset, they are not externally validated by a peer-reviewed publication, and they are not sector-anchored to a published reference standard. They are reviewer-derived weightings that the OCI maintainers consider operationally meaningful but do not claim to be empirically proven.

**Why this disclosure appears at the front.** A methodology that is honest about its maturity is more useful to a procurement reviewer than one that overstates its calibration. Procurement reviewers can build a v1 OCI engagement into a governance pilot with appropriate expectations; they cannot do that work if the methodology is dressed up as empirically validated.

**Where the disclosure is operationally enforced.** Every coefficient cited in this document is annotated in [coefficient-registry.yaml](coefficient-registry.yaml) with a `derivation_status` field. The audit gates that gate publication of this whitepaper (described in §13.4) reject any coefficient that claims a maturity level it does not yet hold. As of v1.0.0, zero coefficients in the registry claim `sector-anchored`, `empirically-calibrated`, or `externally-validated`. Every coefficient is `theoretical` or `practitioner-informed`.

**What OCI v1.0.0 *is*.** A reviewer-led methodology for naming, measuring, and stabilising institutional continuity exposures, supported by a small set of deterministic frameworks whose outputs are read alongside the institutional context that justifies them. The frameworks are useful inputs to a reviewer's judgement. They are not, on their own, findings.

**What OCI v1.0.0 is not.** Predictive of institutional outcomes. A substitute for ISO 22301 or any BCMS certification. A substitute for the institution's own governance process. A scoring system for individuals. A ranking system for institutions. A risk model in the ISO 31000 sense. A maturity model in the CMMI sense.

The body of this document elaborates each of these positions and traces them to the source artifacts that implement them.

---

## §1 Purpose

The OCI Method™ exists to help institutions recognise, map, and steward their continuity exposures before those exposures become institutional failures. "Continuity exposure" in OCI's usage refers to the slowly-compounding structural fact that a small number of stewards carry a large share of an institution's interpretive memory, governance lineage, and operational know-how — and that the institution has not yet named who, what, or how that load is being carried.

This methodology specification serves four purposes:

1. **Auditability.** A reviewer with no prior exposure to OCI must be able to read this document and reproduce any classification the OCI engine emits. The observable criteria files (Appendix C and §8) are written so that a reviewer with the institution's documents and access to its stewards can independently classify a Governance Entropy ordinal, a Stewardship Density band, or a Survivability Matrix cell.

2. **Procurement defensibility.** Institutions operating under ISO 22301, ISO 37000, COBIT 2019, or comparable governance standards must be able to position OCI within their existing governance architecture. §12 (Standards Positioning) and the companion [standards-crosswalk.yaml](standards-crosswalk.yaml) provide that positioning without claiming equivalence where none exists.

3. **Academic exposure.** OCI is published rather than concealed. The methodology, including its limitations, its known risks, and its coefficient maturity, is available for academic critique. §11.5 (Known Methodological Risks) is designed for that critique.

4. **Doctrine continuity.** This document is the single source of authority for the methodology surface. Engineering changes that alter a coefficient, a threshold, or a confidence rule require a corresponding entry in [METHODOLOGY_CHANGELOG.md](METHODOLOGY_CHANGELOG.md) and a corresponding update here. The methodology cannot drift silently from its implementation.

The OCI Method™ is human-led, reviewer-led, and governance-aware by design. It is delivered under explicit institutional consent and bounded by the [OCI Anti-Surveillance Position](../OCI_ANTI_SURVEILLANCE_POSITION.md) and the [OCI AI Boundary](../OCI_AI_BOUNDARY.md). Both documents are constitutive: a feature, framework, or coefficient that would require relaxing either position is rejected at design review rather than implemented.

---

## §2 Scope and audience

### 2.1 In scope

- The five signature frameworks: Stewardship Density Index™, Governance Entropy Scale™, Continuity Burden Map™, Continuity Survivability Matrix™, Reconstruction Burden Index™.
- The five-phase OCI Method™ canonical spine: Recognition, Mapping, Stabilization, Infrastructure, Intelligence.
- The methodology's confidence model and the interpretive caution states surfaced to consumers.
- The observable criteria a reviewer uses to reproduce a classification.
- The methodology's governance: how it is versioned, amended, and audited.
- The methodology's positioning relative to widely-cited standards.

### 2.2 Out of scope

- The product surfaces (workbook UI, PDF executive narrative, HubSpot mapper, CRM integration). The product surfaces consume the frameworks documented here; the frameworks are the subject, not the surfaces.
- The facilitator certification curriculum. See [docs/oci/OCI_FACILITATOR_TRAINING_CURRICULUM.md](../OCI_FACILITATOR_TRAINING_CURRICULUM.md) and [docs/oci/OCI_FACILITATOR_CERTIFICATION_RUBRIC.md](../OCI_FACILITATOR_CERTIFICATION_RUBRIC.md).
- The engagement commercial model. See [docs/oci/OCI_DELIVERY_MODEL.md](../OCI_DELIVERY_MODEL.md).
- The Nzila OS platform architecture. See [docs/architecture](../../architecture/).

### 2.3 Audience and reading paths

| Reader | Recommended reading path |
| --- | --- |
| Procurement reviewer | §0, §11, §11.5, §12, [standards-crosswalk.yaml](standards-crosswalk.yaml) |
| Governance auditor | §0, §6, §7, §8, [observable-criteria/](observable-criteria/) |
| Academic reviewer | §0, §4, §4.5, §6, §10, §11.5, §14 |
| Certified facilitator | All sections |
| Sponsoring institution | §0, §1, §4, §11, §11.5, §15 |

### 2.4 Language and convention

This document is published in English at v1.0.0. A French translation is planned for v1.1.0 with a terminology-lock review to ensure the trademarked framework names retain their institutional meaning. Where this document uses terms that have a defined meaning in OCI doctrine, those terms are introduced on first use and cross-referenced to their canonical definition.

Trademark conventions follow the existing OCI canon: every framework name carries the ™ symbol on first use within each section. The trademark assertion is institutional, not legalistic: the names denote specific OCI artifacts and should not be re-used to describe non-OCI work.

---

## §3 Doctrine lineage

The methodology specification is a synthesis of an existing doctrine corpus. This section names the canonical sources so the reader can verify that the methodology surface is consistent with the wider OCI doctrine.

### 3.1 Canonical doctrine sources

- [docs/oci/OCI_METHOD.md](../OCI_METHOD.md) — the canonical methodology spine. The five-phase methodology, the binding method principles (recognition precedes diagnosis; stewardship is institutional, not personal; reductive stabilization; governance-aware language; reviewer-led use of any computation; opt-in aggregate intelligence; anti-surveillance; honest deferral), and the artifact list per phase are defined there. This document interprets and elaborates `OCI_METHOD.md`; where the two diverge, `OCI_METHOD.md` governs.

- [docs/oci/OCI_AI_BOUNDARY.md](../OCI_AI_BOUNDARY.md) — the four standing rules of AI use within OCI: reasoning is reviewer-led; there is no autonomous decisioning; there is no behavioural inference; there is no inference about non-consented subjects. These rules are constitutive of the methodology and are restated in §15.

- [docs/oci/OCI_ANTI_SURVEILLANCE_POSITION.md](../OCI_ANTI_SURVEILLANCE_POSITION.md) — binding anti-surveillance commitments. Every framework documented here was designed to satisfy these commitments: none score individuals, none infer behaviour, none produce ranked institutional comparisons.

- [docs/oci/OCI_PRIVACY_POSITION.md](../OCI_PRIVACY_POSITION.md) — institutional privacy commitments. The k-anonymity threshold of five contributing institutions per published aggregate band (restated in §7.5) traces to this position.

- [docs/oci/OCI_DATA_HANDLING.md](../OCI_DATA_HANDLING.md) — data handling, retention, and severance.

- [docs/oci/OCI_SECURITY_OVERVIEW.md](../OCI_SECURITY_OVERVIEW.md) — security posture for the supporting platform.

- [docs/oci/stabilization/OCI_CONTINUITY_DEBT.md](../stabilization/OCI_CONTINUITY_DEBT.md) — the Continuity Debt™ signature vocabulary used in §6 framework postures.

### 3.2 Implementation lineage

The five frameworks are implemented in [apps/union-eyes/lib/oci/frameworks/](../../../apps/union-eyes/lib/oci/frameworks/). Each module is pure, deterministic, and side-effect-free. The framework code is consumed by:

- The Workbook engine layer (`apps/union-eyes/lib/workbook/engines/`),
- The PDF narrative engine (`apps/union-eyes/lib/workbook-pdf/`),
- The HubSpot CRM mapper (`apps/union-eyes/lib/hubspot/workbookPropertyMapper.ts`),
- The Facilitated Edition continuity-breakpoints surface.

Engineering changes to any framework module require a corresponding methodology update here and a corresponding entry in the methodology changelog. The framework source files carry an `ARTIFACT TYPE: IP / Framework` header and a `DOCTRINE_VERSION` constant that must match the doctrine version of this document.

### 3.3 What this document does *not* contain

This document does not include the wider OCI documentation surface (the executive briefing decks, the workshop opening scripts, the executive email sequence, the board overview, and the institutional-activation materials). Those are operational artifacts; the methodology specification is the document that allows those artifacts to be trusted.

---

## §4 Methodology philosophy

This section names the small set of philosophical commitments that shape every framework and every product surface that consumes them. The commitments are not metaphors; they are operational rules that have engineering consequences.

### 4.1 Recognition precedes diagnosis

The institution must feel recognised on its own terms before any continuity exposure is named. This commitment shapes the methodology's reading order: the Recognition phase precedes the Mapping phase, and the Mapping phase precedes any framework output that could be received as a diagnosis. Within a single engagement, the Stewardship Density Index™ is not surfaced before the institutional reading note is drafted and accepted by the sponsor. This is enforced at the product layer: the workbook engine declines to emit a density classification before the institutional-reading checkpoint is recorded.

### 4.2 Stewardship is institutional, not personal

Stewardship density, stewardship burden, and stewardship recognition are institutional facts. The methodology does not characterise individual stewards. The frameworks operate on aggregates: counts, criticality weights, tenure bands, successor-readiness flags. Free-text steward notes are never inspected by the framework code; this is hard-coded in the framework module documentation as a binding invariant ("This module operates on aggregates only. Holder names and free-text notes are never inspected.").

The institutional-not-personal commitment has a practical consequence for the framework outputs: the Stewardship Density Index™ surfaces *bands and counts*, not steward names. The Continuity Survivability Matrix™ surfaces *cells*, not steward names. The Reconstruction Burden Index™ surfaces a *score and a band*, not a list of who would need to be replaced.

### 4.3 Reductive stabilization

Stabilization moves must reduce institutional fragility without shifting load to less senior or less recognised stewards. This commitment shapes how the methodology interprets a "good" framework output: a density classification that improves because load was moved onto a junior carrier without explicit recognition is not an improvement; it is a methodological violation surfaced as an apparent improvement. The Stewardship Redistribution Framework™ ([docs/oci/stabilization/STEWARDSHIP_REDISTRIBUTION.md](../stabilization/STEWARDSHIP_REDISTRIBUTION.md)) is the canonical mechanism for honest load redistribution.

### 4.4 Governance-aware language

Framework outputs are written for an institutional governance body to receive. They use the institution's own register where possible and avoid the diagnostic register of clinical assessment, the productivity register of management consulting, and the surveillance register of behavioural analytics. The methodology's editorial discipline is enforced by the [forbidden-vocabulary configuration](../../../apps/union-eyes/tooling/marketing/config/forbidden-vocabulary.ts), which gates 200-plus terms that are inconsistent with the methodology's register.

### 4.5 (Reserved for the maturity classification — see next section)

### 4.6 Reviewer-led use of any computation

No framework output is presented to an institution as a finding. Every output is read by a named human reviewer who endorses or amends it on the institution's behalf. The framework code emits a structured result; the reviewer's interpretation of that result is the authoritative event. This commitment is the bridge between the deterministic framework computations and the human-led method that uses them. The full AI boundary that elaborates this commitment is restated in §15.

### 4.7 Opt-in aggregate intelligence

Any reading that aggregates across institutions is opt-in, written, and revocable. The aggregation respects a k-anonymity threshold (five contributing institutions per published band, restated in §7.5) and crosses only structural facts — bands, counts, ordinals, categorical postures. No prose, no names, no notes, no document content cross the aggregation boundary. The methodology's intelligence layer is permitted only under these constraints.

### 4.8 Anti-surveillance

The methodology does not score individuals, does not infer behaviour, does not produce metrics about stewards or members, and does not produce ranked institutional comparisons that could function as surveillance signals. This is constitutive: a feature that would require violating this commitment is not built.

### 4.9 Honest deferral

The methodology explicitly recognises items that cannot be stabilised within the engagement. A deferred item with a named reason is a successful method outcome. Stabilization pretended where none was possible is a method violation. This shapes how framework outputs are interpreted: a fragile density band that the institution cannot move within the engagement is not a failure of the methodology; it is a finding the methodology has done its job of naming.

---

## §4.5 Methodological Maturity Classification™

This section defines the five-state taxonomy used to classify the maturity of every coefficient, threshold, and observable criterion in the OCI Method™. The classification is the constitutional anchor for the honesty posture introduced in §0: every numeric value used by the methodology carries a maturity state, and the state is auditable.

### 4.5.1 The five states

| State | Meaning | Qualifying evidence | Auditor test |
| --- | --- | --- | --- |
| **Theoretical** | The value is established by design-time logical reasoning. It is an anchor, a reference point, or a structural constraint chosen so that the rest of the methodology can be expressed against it. | Documented design rationale; no claim to empirical or field origin. | The registry entry's rationale field describes the design decision; no empirical claim is made. |
| **Practitioner-Informed** | The value reflects reviewer experience across pre-pilot or pilot engagements. It is not the product of a statistical fit, but it is also not arbitrary: it is the operational weight a reviewer working under the methodology would assign. | Documented reviewer rationale; engagement experience cited; no quantitative fit performed. | The registry entry cites reviewer experience and the assumed invariants the value depends on. |
| **Sector-Anchored** | The value is supported by published sector evidence — a peer-reviewed study, an industry report from a recognised body, or a regulatory benchmark. | Citation to the sector source; rationale describing why the cited evidence supports the value at the chosen level. | The registry entry cites the sector source; a reviewer can verify the citation. |
| **Empirically-Calibrated** | The value has been fit against an OCI-held longitudinal dataset of opted-in institutions, with a documented fit procedure and a documented sample size. | Fit-procedure document; dataset description (with k-anonymity); sample size and confidence interval. | The registry entry links the fit procedure and dataset description; a reviewer can audit the calibration. |
| **Externally-Validated** | The empirically-calibrated value has additionally been validated by a peer-reviewed publication, an independent audit, or both. | Peer-reviewed citation or independent audit report. | The registry entry links the external validation; a reviewer can confirm the validation source. |

### 4.5.2 v1.0.0 honest baseline

At doctrine version 1.0.0, every coefficient in [coefficient-registry.yaml](coefficient-registry.yaml) is classified as **Theoretical** or **Practitioner-Informed**. Zero coefficients claim Sector-Anchored, Empirically-Calibrated, or Externally-Validated. This is the honest baseline and it is the position the methodology surface must take until calibration data and an external audit support a different position.

The structural design of each framework (the choice of inputs, the shape of the composite, the categorical anchor of the survivability matrix) is best described as Practitioner-Informed: it reflects reviewer experience across pre-pilot engagements but has not been validated against an independent sector dataset.

### 4.5.3 Audit enforcement

The audit gate that publishes this document (§13.4) verifies three properties:

1. Every coefficient mentioned in §6 has a corresponding entry in [coefficient-registry.yaml](coefficient-registry.yaml) with a `derivation_status` field set.
2. The `derivation_status` value matches the §4.5 taxonomy.
3. At doctrine version 1.0.0, zero entries carry a `derivation_status` of `sector-anchored`, `empirically-calibrated`, or `externally-validated`.

Violation of any of the three properties is a publication blocker.

### 4.5.4 Advancement protocol

A coefficient advances from one maturity state to the next only by adding evidence to the registry entry and by recording the advancement in [METHODOLOGY_CHANGELOG.md](METHODOLOGY_CHANGELOG.md). Advancement is not retroactive: a coefficient that was practitioner-informed at v1.0.0 cannot be relabelled empirically-calibrated at v1.0.1 without a corresponding change-class `standard` entry in the changelog citing the calibration evidence.

The advancement protocol is the methodology's mechanism for growing into a higher maturity state honestly. It is also the mechanism by which a coefficient that *loses* maturity (because the supporting evidence is withdrawn or invalidated) is demoted: the changelog records the demotion and the registry entry's `derivation_status` is downgraded.

### 4.5.5 Why this section exists

Methodology specifications that present coefficients without a maturity classification implicitly invite the reader to assume those coefficients are calibrated. OCI's coefficients are *not* calibrated at v1.0.0; the maturity classification makes that explicit at every coefficient site. The classification is the operational counterpart of the §0 disclosure: it converts an honest preface into an honest practice.

---

## §4.6 The Construct Invariant™ (single construct, evidence gradient)

This section states a **constitutional invariant** of the methodology — a rule, not an explanation. It governs what OCI/OCRA measures and how the question modalities relate to that measurement. It is frozen on the same footing as the comparability invariant (§6) and the fairness rule: it may not be altered without a constitutional change-class entry in [METHODOLOGY_CHANGELOG.md](METHODOLOGY_CHANGELOG.md).

> **The Construct Invariant.**
> OCI/OCRA measures a **single construct: institutional continuity capability.**
> The question modalities are **different evidence strengths of that one construct**, not different constructs:
>
> | Modality | Evidence type | Evidentiary strength |
> |---|---|---|
> | `maturity_select` | behavioral / operational evidence | **strongest** (dominant) |
> | `multiple_choice` | structural / topological evidence | intermediate |
> | `likert_5` | self-assessed capability evidence | **weakest** (minority) |
>
> **Modalities differ in evidentiary strength, not in construct identity.**

Three consequences follow from the invariant, and each is enforced rather than asserted:

1. **Behavioral evidence is dominant by design.** `maturity_select` is the backbone of the instrument (≈ 65–75 % of the scored surface per [OCI_MODALITY_DOCTRINE.md](../assessment/OCI_MODALITY_DOCTRINE.md) §3; measured behavioral share of the `institutional_continuity` composite ≈ 86 %, see §7.6). Self-assessment is admitted only as the weakest evidence tier, never as a parallel construct that could be traded off against behavior.

2. **Self-assessment is capability evidence, not satisfaction.** `likert_5` items are constrained by doctrine to measure *"perceived continuity **reality**, not satisfaction"* — falsifiable statements about institutional reality, rated for truth. Affective and attitudinal forms ("Do you agree?", "How satisfied are you?") are forbidden. Self-report is therefore a low-confidence reading of the *same* continuity the behavioral items read with high confidence — consistent with the declared-vs-evidenced gradient already encoded in the evidence-strength taxonomy ([evidence-strength/evidenceTaxonomy.ts](../../../apps/union-eyes/lib/icra/evidence-strength/evidenceTaxonomy.ts), `NONE…CROSS_VALIDATED`).

3. **Optimism alone cannot manufacture a score.** Because perception is the weakest tier and is capped to a minority weight (§7.6), an institution cannot reach a high-maturity outcome through confident self-report absent corroborating behavioral evidence. This is not only argued; it is proven by an executable guard, [`__tests__/signal-integrity/constructInvariant.test.ts`](../../../apps/union-eyes/lib/icra/__tests__/signal-integrity/constructInvariant.test.ts), which demonstrates that floor-behavioral evidence with maximally-inflated confidence remains in the lowest maturity band, and that the full confidence range moves the composite by at most ≈ 9 points (the realistic honest-neutral → inflated gaming delta is ≈ 4.7 points).

The invariant is the methodology's answer to the first measurement-theory question a reviewer asks — *"what, exactly, is being measured?"* — and to the sharpest follow-up — *"can optimism alone produce a high score?"*. The answer to the first is *institutional continuity capability, read across an evidence gradient*; the answer to the second is *no*, and it is enforced in CI.

---

## §5 Framework overview

OCI carries five signature frameworks. Each is documented in detail in §6; this section is a reading map.

| Framework | One-line role | Output shape | Source file |
| --- | --- | --- | --- |
| Stewardship Density Index™ | Quantifies how concentrated continuity responsibility is across recognised stewards. | Index (0–1), band (distributed / observed / concentrated / fragile / critical), supporting counts. | [stewardship-density-index.ts](../../../apps/union-eyes/lib/oci/frameworks/stewardship-density-index.ts) |
| Governance Entropy Scale™ | Reads drift between governance design and governance practice on an ordinal 1–5 scale. | Ordinal (1–5), level label, posture statement. | [governance-entropy-scale.ts](../../../apps/union-eyes/lib/oci/frameworks/governance-entropy-scale.ts) |
| Continuity Burden Map™ | Composes density with secondary continuity signals into a unified burden reading. | Composite (0–1), posture statement, contributing-factor breakdown. | [continuity-burden-map.ts](../../../apps/union-eyes/lib/oci/frameworks/continuity-burden-map.ts) |
| Continuity Survivability Matrix™ | Plots institutional dependency against successor readiness on a 3×3 categorical surface. | Cell (one of nine), cell label, posture statement. | [continuity-survivability-matrix.ts](../../../apps/union-eyes/lib/oci/frameworks/continuity-survivability-matrix.ts) |
| Reconstruction Burden Index™ | Estimates the operational-disruption cost of reconstructing institutional knowledge after a continuity break. | Score (0–10), band (minimal / moderate / substantial / severe), posture statement. | [reconstruction-burden-index.ts](../../../apps/union-eyes/lib/oci/frameworks/reconstruction-burden-index.ts) |

The frameworks compose without claiming to be a unified score. There is no single "OCI score". The OCI Operational Profile (a Facilitated Edition synthesis) is a multi-facet reading that names each framework's contribution; it is not a weighted sum. The methodology deliberately refuses single-number summaries because such summaries flatten the institutional context the methodology exists to preserve.

---

## §6 Frameworks in detail

Each framework subsection follows the same shape: purpose, inputs, computation, outputs, coefficient table (with maturity tags), surfacing rules, and a per-framework honesty note. Every coefficient cited here resolves to an entry in [coefficient-registry.yaml](coefficient-registry.yaml) by symbol.

### 6.1 Stewardship Density Index™

#### 6.1.1 Purpose

The Stewardship Density Index™ (SDI) reads how concentrated institutional knowledge is across the institution's recognised continuity carriers. It is the percentage of weighted criticality-and-tenure load sitting with carriers who have no identified successor. Higher index values denote more concentrated, more fragile stewardship.

#### 6.1.2 Inputs

The index takes a list of continuity carriers. Each carrier is described by three institutional facts:

- **Criticality.** One of `routine`, `important`, `load_bearing`, or `institution_critical`. These are doctrine-canonical criticality bands defined alongside the framework.
- **Tenure band.** One of `0_3y`, `3_7y`, `7_15y`, or `15y_plus`. The bands reflect institutional-memory horizons rather than employment milestones.
- **Successor identified.** Boolean. Is there an identified successor for this carrier?

The index does not inspect names, free-text notes, demographics, performance evaluations, or any other personal attribute. The framework's source documentation enforces this as a binding invariant.

#### 6.1.3 Computation

For each carrier, the framework computes a per-carrier weight as the product of the carrier's criticality weight and tenure amplifier:

```
weight_i = criticality_weight[i] × tenure_amplifier[i]
```

The total weight across all carriers is the denominator. The exposed weight (sum across carriers with no identified successor) is the numerator. The index is the ratio:

```
index = exposed_weight / total_weight
```

The index is clamped to `[0, 1]`. NaN or non-finite intermediate values are treated as zero (the framework rejects malformed input rather than poisoning downstream consumers).

#### 6.1.4 Outputs

The framework returns:

- `index`: scalar in `[0, 1]`, rounded to two decimal places.
- `band`: one of `distributed`, `observed`, `concentrated`, `fragile`, `critical`, classified by the band thresholds below.
- Supporting counts: total carriers, load-bearing count, institution-critical count, unsuccessed load-bearing count, unsuccessed institution-critical count, total weight, exposed weight.

#### 6.1.5 Coefficients (with maturity tags)

| Symbol | Value | Maturity |
| --- | --- | --- |
| `CRITICALITY_WEIGHT.routine` | 0.25 | Practitioner-Informed |
| `CRITICALITY_WEIGHT.important` | 0.5 | Practitioner-Informed |
| `CRITICALITY_WEIGHT.load_bearing` | 0.85 | Practitioner-Informed |
| `CRITICALITY_WEIGHT.institution_critical` | 1.0 | Theoretical (anchor) |
| `TENURE_AMPLIFIER.0_3y` | 0.6 | Practitioner-Informed |
| `TENURE_AMPLIFIER.3_7y` | 0.85 | Practitioner-Informed |
| `TENURE_AMPLIFIER.7_15y` | 1.0 | Theoretical (reference) |
| `TENURE_AMPLIFIER.15y_plus` | 1.15 | Practitioner-Informed |
| `DENSITY_BANDS.critical.lowerBound` | 0.7 | Practitioner-Informed |
| `DENSITY_BANDS.fragile.lowerBound` | 0.5 | Practitioner-Informed |
| `DENSITY_BANDS.concentrated.lowerBound` | 0.3 | Practitioner-Informed |
| `DENSITY_BANDS.observed.lowerBound` | 0.15 | Practitioner-Informed |
| `DENSITY_BANDS.distributed.lowerBound` | 0.0 | Theoretical (floor) |

The full rationale and `assumed_invariants` for each coefficient are recorded in [coefficient-registry.yaml](coefficient-registry.yaml).

#### 6.1.6 Surfacing rules

The SDI surfaces the index value, the band label, and the band's posture statement together. The posture statement is the institutionally-meaningful interpretation; the numeric index is the structural fact that justifies it. Product surfaces that consume the SDI must surface both; a numeric index without its posture statement is not a valid surfacing.

When the sample-size policy ([sample-size-policy.yaml](sample-size-policy.yaml)) classifies the input as below threshold (fewer than five carriers), the interpretive caution state `low_confidence_density` is surfaced alongside the result. The product surfaces are required to render the caution state verbatim.

#### 6.1.7 Per-framework honesty note

The SDI coefficients reflect a reviewer's judgement of how much weight institution-critical roles should carry relative to routine roles, and how much weight long-tenure carriers should carry relative to short-tenure carriers. These weights have not been fit against a longitudinal dataset of opted-in institutions. They are reviewer-derived and operationally meaningful, not empirically calibrated. The framework should be treated as a structural reading, not a diagnostic claim. The v2 calibration plan recorded in [coefficient-registry.yaml](coefficient-registry.yaml) describes the empirical work that would be required to advance any of these coefficients to Sector-Anchored or higher.

### 6.2 Governance Entropy Scale™

#### 6.2.1 Purpose

The Governance Entropy Scale™ (GES) reads the drift between an institution's recorded governance precedents and the way those precedents are currently interpreted in practice. The scale is ordinal (1–5); higher ordinals denote greater drift.

#### 6.2.2 Inputs

The framework accepts a single scalar `drift` value in `[0, 1]`. The drift value is produced by the Workbook Governance Lineage engine, which scores paired governance-design and governance-practice observations. The pairing logic is the responsibility of the Workbook engine; this framework specifies the classification.

#### 6.2.3 Computation

The framework classifies the drift scalar against five ordered thresholds, returning the highest level whose `lowerBound` does not exceed the drift value. Non-finite inputs are treated as zero (coherent).

#### 6.2.4 Outputs

- `ordinal`: integer 1–5.
- `id`: one of `coherent`, `recognised_drift`, `patterned_drift`, `institutional_drift`, `systemic_entropy`.
- `label`: human-readable label.
- `posture`: posture statement.

#### 6.2.5 Coefficients (with maturity tags)

| Symbol | Value | Maturity |
| --- | --- | --- |
| `ENTROPY_LEVELS.systemic_entropy.lowerBound` | 0.8 | Practitioner-Informed |
| `ENTROPY_LEVELS.institutional_drift.lowerBound` | 0.6 | Practitioner-Informed |
| `ENTROPY_LEVELS.patterned_drift.lowerBound` | 0.4 | Practitioner-Informed |
| `ENTROPY_LEVELS.recognised_drift.lowerBound` | 0.2 | Practitioner-Informed |
| `ENTROPY_LEVELS.coherent.lowerBound` | 0.0 | Theoretical (floor) |

#### 6.2.6 Observable criteria

Each ordinal has a corresponding observable-criteria file ([observable-criteria/entropy-1.yaml](observable-criteria/entropy-1.yaml) through [entropy-5.yaml](observable-criteria/entropy-5.yaml)) describing the observable indicators, governance evidence, process visibility, documentation maturity, decision-continuity indicators, institutional-dependency indicators, and onboarding-survivability indicators a reviewer uses to reproduce the classification independently of the engine. The criteria are written so that an auditor can pass each check using only the institution's documents and conversations with its stewards.

#### 6.2.7 Surfacing rules

The GES surfaces the ordinal, the label, and the posture together. Where the Workbook engine reports fewer than ten paired observations (per [sample-size-policy.yaml](sample-size-policy.yaml)), the `low_confidence_entropy` caution state is surfaced alongside the result.

#### 6.2.8 Per-framework honesty note

The GES thresholds reflect reviewer judgement of where drift becomes operationally significant. The same drift scalar at v1.0.0 has not been validated against an independent governance-audit dataset; the empirical work that would advance these thresholds to Sector-Anchored is recorded in the registry's v2 calibration plan. The scale should be used as a structural reading paired with the observable criteria, not as a numeric diagnosis.

The scale is intentionally not a CMMI-style maturity model; the cross-walk in §12 records this explicitly. Surface similarity (five levels, ordinal scale) should not be read as semantic equivalence.

### 6.3 Continuity Burden Map™

#### 6.3.1 Purpose

The Continuity Burden Map™ (CBM) composes the SDI with two secondary continuity signals into a unified burden composite. It is the cross-module reading consumed by the workbook executive narrative and the burden-visualization surface in the Facilitated Edition.

#### 6.3.2 Inputs

- `density`: the structured result of the SDI (see §6.1).
- `icraBurdenIndex`: optional scalar in `[0, 1]` from the Workbook ICRA module.
- `reconstructionRisk`: optional scalar in `[0, 1]`.

Missing inputs default to zero; the confidence model (§7) classifies the result as low-confidence if fewer than three components are present.

#### 6.3.3 Computation

```
density_component       = density.index × DENSITY_WEIGHT
icra_component          = icra × ICRA_WEIGHT
reconstruction_component = reconstruction × RECONSTRUCTION_WEIGHT
composite               = clamp01(density + icra + reconstruction components)
```

The weights sum to 1.0 by design. The composite is rounded to two decimal places.

#### 6.3.4 Coefficients (with maturity tags)

| Symbol | Value | Maturity |
| --- | --- | --- |
| `DENSITY_WEIGHT` | 0.6 | Practitioner-Informed |
| `ICRA_WEIGHT` | 0.25 | Practitioner-Informed |
| `RECONSTRUCTION_WEIGHT` | 0.15 | Practitioner-Informed |
| `posturalStatement.severe_threshold` | 0.7 | Practitioner-Informed |
| `posturalStatement.substantial_threshold` | 0.5 | Practitioner-Informed |
| `posturalStatement.moderate_threshold` | 0.3 | Practitioner-Informed |

A binding invariant: `DENSITY_WEIGHT + ICRA_WEIGHT + RECONSTRUCTION_WEIGHT == 1.0`. The framework's hardening tests enforce this.

#### 6.3.5 Surfacing rules

The CBM surfaces the composite, the posture, and a contributing-factor breakdown (the weighted contributions of each component). The breakdown is required so the reader can see which input drove the composite — a high composite driven by density alone is a different finding from a high composite driven by all three components converging.

#### 6.3.6 Per-framework honesty note

The CBM's weights reflect the reviewer judgement that stewardship density is the dominant continuity signal and that ICRA and reconstruction risk are confirmatory rather than primary. The weights have not been fit against an outcome dataset. Sensitivity scenarios in [sensitivity/scenarios.yaml](sensitivity/scenarios.yaml) document how the composite behaves under ±20% perturbation of the dominant weight. The framework should be read as a structural composite, not as a probabilistic risk score.

### 6.4 Continuity Survivability Matrix™

#### 6.4.1 Purpose

The Continuity Survivability Matrix™ (CSM) is a categorical surface that classifies an institutional domain by two axes: dependency concentration and successor readiness. The matrix is the IP shape consumed by the Facilitated Edition continuity-breakpoints surface and the Self-Guided Edition executive narrative.

#### 6.4.2 Axes and cells

- Dependency concentration: `distributed | concentrated | singular`.
- Successor readiness: `identified | in_progress | absent`.

The 3×3 cross-product yields nine cells, each with a doctrine-defined label and posture. The full cell list (with postures) is in the framework source file and is restated in [Appendix B](#appendix-b-cell-table-csm).

#### 6.4.3 Worst-case fallback

The framework returns the worst-case cell (`singular_absent`, "Continuity break imminent on transition") when the input enums are unknown. This is a fail-loud-in-meaning rule: an unmodelled configuration must not surface as a healthy posture (such as `distributed_identified`) because the consumer would then receive false reassurance. The hardening tests verify this fallback explicitly.

#### 6.4.4 Coefficients (with maturity tags)

The CSM has no numeric coefficients. The categorical postures are Theoretical anchors; the worst-case fallback rule is a Theoretical commitment derived from the anti-overclaim principle.

| Symbol | Value | Maturity |
| --- | --- | --- |
| `matrix.shape` | 3×3 | Theoretical |
| `WORST_CASE_CELL` | `singular_absent` | Theoretical |

#### 6.4.5 Per-framework honesty note

The CSM is categorical. It does not produce a numeric score; it produces a cell label and a posture statement. The choice of axes (dependency concentration, successor readiness) reflects reviewer judgement that these two structural facts explain the largest share of continuity-survivability variation. The framework should be used as a categorical reading paired with the institution's own domain knowledge.

### 6.5 Reconstruction Burden Index™

#### 6.5.1 Purpose

The Reconstruction Burden Index™ (RBI) estimates the operational-disruption cost of reconstructing institutional knowledge after a continuity break. The score is a deterministic composition of exposed-carrier count, institution-critical carrier count, stewardship density, and (optionally) governance entropy ordinal.

#### 6.5.2 Inputs

- `exposedCarriers`: count of continuity carriers without identified successors.
- `institutionCriticalCarriers`: count of carriers tagged institution-critical.
- `densityIndex`: scalar in `[0, 1]` from the SDI.
- `governanceEntropyOrdinal`: optional integer 1–5; defaults to 2 (recognised drift) when absent.

Negative carrier counts and non-finite values are coerced to zero. Ordinals outside `[1, 5]` fall back to the default.

#### 6.5.3 Computation

```
exposed_component       = min(EXPOSED_CAP, exposedCarriers × 0.8)
critical_component      = min(CRITICAL_CAP, institutionCriticalCarriers × 1.0)
density_component       = densityIndex × 2.0
entropy_component       = (entropyOrdinal - 1) × 0.25
score                   = clamp(sum, 0, MAX_SCORE)
```

The score is rounded to one decimal place.

#### 6.5.4 Outputs

- `score`: scalar in `[0, 10]`.
- `band`: one of `minimal`, `moderate`, `substantial`, `severe`.
- `posture`: posture statement.

#### 6.5.5 Coefficients (with maturity tags)

| Symbol | Value | Maturity |
| --- | --- | --- |
| `exposed_carrier_weight` | 0.8 | Practitioner-Informed |
| `EXPOSED_CAP` | 4 | Practitioner-Informed |
| `critical_carrier_weight` | 1.0 | Practitioner-Informed |
| `CRITICAL_CAP` | 3 | Practitioner-Informed |
| `density_multiplier` | 2.0 | Practitioner-Informed |
| `entropy_per_ordinal_step` | 0.25 | Practitioner-Informed |
| `DEFAULT_ENTROPY_ORDINAL` | 2 | Practitioner-Informed |
| `MAX_SCORE` | 10 | Theoretical (anchor) |
| `severe_threshold` | 7 | Practitioner-Informed |
| `substantial_threshold` | 5 | Practitioner-Informed |
| `moderate_threshold` | 3 | Practitioner-Informed |

The caps (`EXPOSED_CAP=4`, `CRITICAL_CAP=3`) are deliberate: beyond these counts, the index saturates and the institution should be read through other frameworks (density and entropy) rather than through additional carrier counts. The cap structure prevents the index from claiming unbounded precision in the worst-case regime.

#### 6.5.6 Per-framework honesty note

The RBI is a composition of practitioner-informed weights bounded by caps. The 0–10 score range is a deliberate operational-disruption scale; it is not a probability, not a duration estimate in months, and not a financial estimate. The score should be read as a relative ordering across institutions or across snapshots of the same institution over time, paired with the band's posture statement. The empirical work that would advance any of the RBI coefficients to Sector-Anchored is recorded in [coefficient-registry.yaml](coefficient-registry.yaml).

---

## §7 Confidence model

The methodology surfaces results under a confidence model rather than as bare values. This section specifies the confidence states, the input-quantity thresholds, the surfacing rules, and the scoring role of perception-based confidence signals relative to behavioral evidence (§7.6).

### 7.1 Confidence states

Each framework's input quantity is classified into one of three confidence states:

- **Low confidence.** The input is below the methodology's minimum-quantity threshold. The result is structural but provisional; the consumer must not treat it as a finding.
- **Moderate confidence.** The input meets the methodology's working threshold. The result is operationally meaningful and may inform reviewer interpretation.
- **High confidence.** The input meets the methodology's stability threshold. The result is robust to small input perturbations.

The numeric thresholds per framework are recorded in [sample-size-policy.yaml](sample-size-policy.yaml).

### 7.2 Interpretive caution states

A low-confidence result is paired with a framework-specific interpretive caution state. The caution states are:

- `low_confidence_density`
- `low_confidence_entropy`
- `low_confidence_burden_composite`
- `partial_coverage_survivability`
- `low_confidence_reconstruction`

The caution-state posture sentences are recorded verbatim in [sample-size-policy.yaml](sample-size-policy.yaml) and must be surfaced unchanged by product surfaces that consume the framework results.

### 7.3 Surfacing requirements

Product surfaces (workbook UI, PDF executive narrative, HubSpot mapper) consuming framework results must surface:

1. The framework value (index, ordinal, composite, cell, or score).
2. The framework band or label.
3. The framework posture statement.
4. The interpretive caution state, if the input is below threshold.

A surface that renders the value without the caution state is a methodology violation.

### 7.4 No probability claims

The confidence model is a state-classification, not a probability. It does not say "this result is 80% likely to be correct"; it says "this input quantity is below / at / above the threshold at which the methodology considers the result robust." Probability claims would require the empirical calibration that v1.0.0 does not yet have.

### 7.5 Aggregation k-anonymity

The methodology's intelligence layer aggregates structural framework outputs across opted-in institutions. The aggregation respects a k-anonymity threshold of **five contributing institutions per published band**. Below this threshold, the band is not published and the contributing institutions are not exposed to re-identification risk. This threshold is doctrine-canonical and is restated in [docs/oci/OCI_METHOD.md](../OCI_METHOD.md) §9 and in [sample-size-policy.yaml](sample-size-policy.yaml).

### 7.6 Confidence signals vs. maturity evidence (scoring role)

This subsection states, precisely and reproducibly, **how perception-based confidence signals affect scoring** — the question a procurement reviewer asks first. The assessment instrument carries three answer modalities: `maturity_select` (behavioral maturity evidence), `multiple_choice` (structural topology), and `likert_5` **Continuity Confidence Signals** (the institution's own read of its survivability — e.g. *"Operational knowledge is consistently recoverable when key individuals are unavailable."*). Confidence signals are perception statements, not behavioral evidence, and the methodology treats them accordingly through **two separate, bounded roles**.

**Construct basis — why perception is admitted to the score at all.** The prior, sharper question a sophisticated reviewer asks is not *"how much"* but *"why at all"*: why should perception contribute to a maturity composite? The answer is a deliberate construct decision, not an operational accident, and it is stated as a frozen constitutional rule in [§4.6 (The Construct Invariant)](#46-the-construct-invariant-single-construct-evidence-gradient). OCI measures **one construct — institutional continuity capability — read across an evidence gradient**, not "capability plus a separate confidence number." The three modalities are three *evidence tiers* on that single construct: `maturity_select` is behaviorally-evidenced capability (the dominant tier), `multiple_choice` is structurally-evidenced topology, and `likert_5` is **self-assessed capability — the weakest evidence tier of the same continuity construct**. Critically, `likert_5` is constrained by doctrine ([OCI_MODALITY_DOCTRINE.md §4](../assessment/OCI_MODALITY_DOCTRINE.md)) to measure *"perceived continuity **reality**, not satisfaction"*: every confidence item is a falsifiable statement about institutional reality ("operational knowledge **is** recoverable when key people are unavailable") that the institution rates for truth, and affective or attitudinal forms ("Do you agree?", "How satisfied are you?") are **forbidden**. Self-assessed capability is a legitimate but lowest-confidence reading of the same thing behavioral evidence reads with higher confidence — which is precisely why the methodology already distinguishes *declared* continuity from *evidenced* continuity in its evidence-strength taxonomy ([evidence-strength/evidenceTaxonomy.ts](../../../apps/union-eyes/lib/icra/evidence-strength/evidenceTaxonomy.ts), `NONE…CROSS_VALIDATED`). Perception therefore belongs in the construct as a **minority corroboration tier**, never as dominant evidence, and is subordinated to behavior by three explicit disciplines: a capped minority weight (Role 1), a contradiction channel that *reduces* confidence whenever self-report outruns behavior (Role 2), and a per-dimension floor that keeps perception a live *sensing* input rather than a scoring lever (Doctrine floor). This is the methodology's settled position: **Option A — perception is a legitimate, bounded, evidence-graded component of continuity capability — not Option B (perception as a purely diagnostic signal excluded from the composite).** The Option B posture (confidence weight → 0, perception retained only as an envelope/contradiction input) remains a recognized future alternative, but it is a construct-semantics change reserved for the governed migration described under *Honest disclosure* below — it is not the current methodology.

**Role 1 — minority weighted contribution to dimension scores.** Confidence signals carry dimension weights and therefore contribute to the composite, but only as a **minority corroboration input**. The measured share of each dimension's total scoring weight carried by `likert_5` signals is:

| Dimension | `likert_5` (confidence) share | Dominant evidence |
|---|---:|---|
| `institutional_continuity` (the composite) | **9.4 %** | `maturity_select` 86.4 %, `multiple_choice` 4.2 % |
| `governance_fragility` | 7.6 % | behavioral / topology 92.4 % |
| `trust_debt` | 11.0 % | behavioral / topology 89.0 % |
| `operational_memory` | 11.4 % | behavioral / topology 88.6 % |
| `transition_readiness` | 11.1 % | behavioral / topology 88.9 % |

Because confidence never exceeds **~11 %** of any dimension's weight (and 9.4 % of the headline composite), perception **cannot dominate a score and cannot move a maturity band on its own**. Two bounds make this concrete and are both verified by the executable guard [`__tests__/signal-integrity/constructInvariant.test.ts`](../../../apps/union-eyes/lib/icra/__tests__/signal-integrity/constructInvariant.test.ts):

- **Realistic gaming swing ≈ 4.7 points.** An institution that would honestly answer *neutral* (midpoint) but instead answers every Continuity Confidence Signal at the ceiling shifts the `institutional_continuity` composite by at most **≈ 4.7 points** on the 0–100 scale (0.094 × 0.5 × 100). This is the realistic over-claiming delta.
- **Absolute full-range swing ≈ 9.4 points.** Across the *entire* confidence range — from the floor (every confidence item at the minimum) to the ceiling (every item at the maximum) — the composite moves by at most **≈ 9.4 points** (0.094 × 1.0 × 100). This is the hard upper bound on everything the confidence channel can do.

Both bounds are narrower than the 30-point lowest maturity band. The decisive consequence is proven empirically by the same guard: **floor behavioral evidence combined with maximally-inflated confidence remains in the lowest maturity band** (composite < 30) and cannot approach a high-maturity outcome. Optimism alone cannot manufacture a score. The dominant evidence in every dimension is behavioral (`maturity_select`) and structural (`multiple_choice`).

**Role 2 — primary input to the independent confidence-and-contradiction channel.** Confidence signals are the backbone of the confidence envelope (§7.1–§7.4) and the contradiction-detection engine. This channel is **monotonic-downward by doctrine: contradictions REDUCE confidence; they are never averaged and never inflate a score** (see [`contradictions/confidencePenaltyBridge.ts`](../../../apps/union-eyes/lib/icra/contradictions/confidencePenaltyBridge.ts)). When an institution reports high confidence that contradicts its behavioral or structural answers — e.g. *"operational knowledge is recoverable"* alongside an `undocumented, individually-held` topology selection — the contradiction lowers the **confidence** attached to the reading; it does not silently raise the maturity score.

**Doctrine floor.** Every dimension retains **at least one** confidence-sensitive `likert_5` input by design, enforced by [`confidenceGenerationCoverage.test.ts`](../../../apps/union-eyes/lib/icra/__tests__/signal-integrity/confidenceGenerationCoverage.test.ts). Perception is therefore always *sensed* and always available for contradiction analysis — but never as the dominant evidence for a score.

**Honest disclosure and governed option.** The maintainers deliberately retain a minority confidence weight rather than zeroing it, for two reasons: (a) it guarantees each dimension has a live perception channel for contradiction detection, and (b) it preserves score comparability with every prior assessment (the one-scale comparability invariant of §6). **Fully decoupling confidence from the composite** (confidence weight → 0, confidence retained solely as an envelope/contradiction input) is a recognized and legitimate future posture, but it changes composite semantics for every historical assessment; it is therefore reserved for a **governed scoring-version migration** with a corresponding [METHODOLOGY_CHANGELOG.md](METHODOLOGY_CHANGELOG.md) entry, not a silent toggle. The scoring engine that implements this is [`apps/union-eyes/lib/icra/scoring.ts`](../../../apps/union-eyes/lib/icra/scoring.ts); every contribution is traceable to a question answer, a published dimension weight, and (for risk dimensions) a per-question inversion flag.

---

## §8 Observable criteria (reviewer reproducibility)

The methodology is designed so that a reviewer with the institution's documents and access to its stewards can independently reproduce any framework classification. The mechanism is the observable-criteria files.

### 8.1 What an observable criterion is

An observable criterion is a structured pair: a `requirement` statement that names a concrete institutional fact, and an `auditor_check` instruction that names how a reviewer can verify the fact. The criterion does not require access to the OCI engine; it requires only access to the institution's documents and conversations.

Example, drawn from [observable-criteria/entropy-1.yaml](observable-criteria/entropy-1.yaml):

> **Requirement.** For every governance decision in the past twelve months, the precedent that authorises the decision can be cited within five minutes by the governance liaison.
>
> **Auditor check.** Sample five decisions from the last twelve months. Ask the governance liaison to cite the authorising precedent for each. Pass if ≥ 4 of 5 cited within five minutes.

A reviewer who follows the auditor check produces an outcome (pass / fail). A series of such outcomes across the indicators for a given Governance Entropy ordinal yields a classification.

### 8.2 Observable-criteria categories

For the Governance Entropy Scale™, each ordinal has criteria across seven categories:

1. **Observable indicators** — primary classification evidence.
2. **Governance evidence** — meeting cadence, quorum discipline, emergency-resolution frequency.
3. **Process visibility** — decision register currency, documentation rate.
4. **Documentation maturity** — charter currency, policy versioning, shadow-version prevalence.
5. **Decision continuity** — briefing practice, transition continuity, context-loss incidents.
6. **Institutional dependency indicators** — single-steward governance domain count.
7. **Onboarding survivability indicators** — onboarding artifact existence, recently-onboarded retention.

Each criterion is identified by a stable ID (e.g. `L3-OBS-01-recurring-precedent-gaps`) so that audit reports can cite criteria by ID.

### 8.3 What observable criteria do *not* claim

The criteria are not a checklist that mechanically determines an ordinal. They are reviewer aids. A reviewer carrying multiple criteria that point to different ordinals exercises judgement about which ordinal best characterises the institution; the methodology does not pretend the classification is a counting exercise. The criteria exist so the reviewer's judgement is *reproducible* — another reviewer applying the same criteria to the same institution should reach a similar classification — not so the judgement is *automated away*.

### 8.4 Future work for the other four frameworks

At v1.0.0, observable-criteria files exist for the Governance Entropy Scale™ only. Observable criteria for the Stewardship Density Index™, the Continuity Burden Map™, the Continuity Survivability Matrix™, and the Reconstruction Burden Index™ are planned for v1.1.0 and will follow the same structure. The frameworks remain reproducible at v1.0.0 from the explicit input definitions in §6 and from the sensitivity scenarios in §10 and [sensitivity/scenarios.yaml](sensitivity/scenarios.yaml).

---

## §9 Workflow integration

The frameworks are consumed by a defined set of product surfaces. This section documents how each surface uses the framework results so that an integration reviewer can verify that the methodology is honoured at the surface boundary.

### 9.1 Workbook engine layer

The Workbook engine layer (`apps/union-eyes/lib/workbook/engines/`) is the primary consumer of all five frameworks. The engine layer:

- Calls the framework modules with the institutional inputs accumulated through the discovery sessions.
- Wraps each result with the framework's posture statement and the confidence state from the sample-size policy.
- Persists the wrapped result alongside the engagement-version metadata.

The engine layer does not reinterpret or recompute framework values. The framework modules are the canonical source for the computations; the engine layer's role is to gather inputs, call the framework, and persist the result.

### 9.2 PDF executive narrative

The PDF executive narrative (`apps/union-eyes/lib/workbook-pdf/`) renders the framework results in publication-grade prose. Surfacing rules:

- Each framework's value, band, posture, and caution state (if applicable) appear in the same paragraph.
- The contributing-factor breakdown for the Continuity Burden Map™ is rendered as a labelled list, not as a chart that could be misread as a probability distribution.
- The PDF carries the doctrine version, the methodology surface version, and the source-of-truth references that allow a reader to audit the values back to the framework source files.

### 9.3 HubSpot CRM mapper

The HubSpot mapper (`apps/union-eyes/lib/hubspot/workbookPropertyMapper.ts`) writes framework results to the institution's CRM record. The mapper:

- Writes the band or ordinal as a categorical property.
- Suffixes the property with the caution state where applicable.
- Does not write the underlying numeric value (the band is the doctrine-canonical surface, not the raw scalar).

### 9.4 Facilitated Edition continuity-breakpoints surface

The Facilitated Edition continuity-breakpoints surface consumes the Continuity Survivability Matrix™ at the domain level. The surface:

- Renders one cell per institutional domain.
- Pairs each cell with its posture statement and with the reviewer's interpretive note added during facilitation.
- Records the cell's selection in the engagement archive so that the survivability reading can be reproduced from the archive without re-running the engine.

### 9.5 Intelligence layer (opt-in aggregation)

The intelligence layer (`packages/oci-intelligence/`) consumes framework outputs across opted-in institutions. The layer respects:

- The k-anonymity threshold (§7.5).
- The doctrine commitment that only structural facts cross the aggregation boundary.
- The institution's revocable consent, which removes its contribution from subsequent aggregations and any baseline they support.

---

## §10 Sensitivity analysis

The methodology's coefficients are Practitioner-Informed or Theoretical at v1.0.0. Sensitivity analysis matters at this maturity level because it answers a procurement reviewer's reasonable question: "What happens to the classifications if your coefficients are off by 10 or 20 percent?"

### 10.1 Method

[sensitivity/scenarios.yaml](sensitivity/scenarios.yaml) contains 25 structured scenarios — five per framework — with documented inputs, expected outputs at the v1.0.0 coefficients, and perturbation results when a single load-bearing coefficient is moved by ±20%. The scenarios are also the basis for regression-style invariant tests in `apps/union-eyes/lib/oci/frameworks/__tests__/`.

### 10.2 Headline findings

The following table summarises the perturbation behaviour observed across the 25 scenarios.

| Framework | Most load-bearing coefficient | Robustness summary |
| --- | --- | --- |
| Stewardship Density Index™ | `DENSITY_BANDS.fragile.lowerBound` / `critical.lowerBound` | Healthy and worst-case scenarios are robust to ±20% perturbations; scenarios near the fragile/critical boundary (index ~0.66) can tip between bands. |
| Governance Entropy Scale™ | Level thresholds | Ordinal classifications away from the threshold boundaries are robust; classifications near a threshold can tip by one ordinal under ±20% perturbation. |
| Continuity Burden Map™ | `DENSITY_WEIGHT` | The composite is most sensitive to `DENSITY_WEIGHT`; a −20% perturbation moves the documented `cbm-05` scenario from substantial to moderate. |
| Continuity Survivability Matrix™ | n/a (categorical) | Categorical; sensitivity arises only at the input-enum boundary. The worst-case fallback rule makes unknown enum input loud. |
| Reconstruction Burden Index™ | `density_multiplier` | Bands are stable under ±20% perturbation of the density multiplier in the documented scenarios; the cap structure (`EXPOSED_CAP`, `CRITICAL_CAP`) bounds carrier-component sensitivity. |

### 10.3 Interpretation

The sensitivity analysis supports two reviewer conclusions:

1. **Bands are robust away from thresholds.** A reviewer reading a band classification well away from the threshold boundaries can have confidence the classification is not a coefficient-perturbation artifact.
2. **Boundary tipping is visible.** The methodology does not hide that classifications near a threshold can tip under small coefficient changes; the scenarios document the tipping explicitly so reviewers can interpret near-boundary results with appropriate caution.

This is the appropriate honest posture for a v1.0.0 methodology whose coefficients are Practitioner-Informed: bands away from boundaries are operationally meaningful; bands at boundaries are surfaced with the underlying value so the reviewer can apply judgement.

### 10.4 What sensitivity analysis does *not* establish

Sensitivity analysis demonstrates how the framework outputs respond to coefficient perturbation. It does not establish that the framework outputs are correct. Correctness in the empirical sense — does a "fragile" classification actually predict elevated continuity-failure rates? — is the work of empirical calibration (§14), which v1.0.0 does not claim.

---

## §11 Limitations and non-intended uses

The methodology is defined as much by what it refuses to do as by what it does. This section names the limitations explicitly so a procurement reviewer can confirm OCI is not being represented as something it is not.

### 11.1 Not a predictive certainty

The framework outputs are structural readings, not predictions. A "fragile" Stewardship Density Index™ classification does not predict that the institution will experience a continuity failure within a given window; it identifies a structural configuration the methodology associates with elevated continuity exposure. Whether the exposure materialises depends on transitions, stabilization actions, and institutional context that the framework does not model.

### 11.2 Not a legal determination

The framework outputs are not legal findings. They cannot be cited as evidence in legal proceedings, regulatory inquiries, or compliance audits as standalone determinations. They can be cited as supporting context within a legal or compliance argument that the institution's own counsel constructs.

### 11.3 Not an institutional ranking

The methodology does not rank institutions. The intelligence layer publishes aggregate bands above the k-anonymity threshold; it does not publish ordered lists of institutions. The methodology refuses single-number institutional summaries that would invite ranking.

### 11.4 Not psychological or behavioural analysis

The frameworks do not model individuals. They do not produce psychological profiles, behavioural inferences, performance evaluations, or attention metrics. The anti-surveillance position (§4.8) is constitutive.

### 11.5 Not an employee evaluation tool

The Stewardship Density Index™, in particular, is sometimes misread as an evaluation of the stewards whose load it surfaces. It is not. The index reports institutional concentration; it does not characterise the carriers. The methodology is operationally enforced to prevent its use as an evaluation tool: the framework code never inspects names, free-text notes, or any personal attribute.

### 11.6 Not a substitute for HR processes

The methodology does not produce succession plans for individuals; it produces institutional readings of successor-readiness coverage. Talent-management methodologies (such as those discussed in §12 under DDI and Korn Ferry) operate at the individual level and are complementary to OCI's institutional readings.

### 11.7 Not a BCMS certification

OCI is not certified under ISO 22301 and does not certify institutions under ISO 22301. The two methodologies address different time horizons and different failure modes. An institution running both is running two complementary practices, not redundant ones.

### 11.8 Not a substitute for governance review

The framework outputs inform an institution's own governance review; they do not replace it. A governance body receiving an OCI-derived continuity plan amends, adopts, or declines on its own terms.

### 11.9 Bounded interpretive authority

The methodology asserts interpretive authority only within its declared scope (continuity exposures, governance entropy, stewardship density, reconstruction burden). It does not assert authority over institutional strategy, organisational design, labour-relations matters, technology architecture, financial governance, or any institutional domain that lies outside the continuity scope. Where OCI engagements surface findings that touch on adjacent domains, the methodology requires the facilitator to refer the institution to appropriate counterpart practitioners rather than extend OCI's interpretive authority into those domains.

---

## §11.5 Known methodological risks

A serious methodology specification acknowledges the threats to its measurement validity explicitly. This section enumerates the known risks that affect OCI's framework outputs at v1.0.0, names how each manifests, names the v1 mitigation, names the v2 mitigation roadmap, and acknowledges the residual risk.

### 11.5.1 Survivorship bias

**Definition.** OCI observes institutions that survived to be measured. Institutions that failed to maintain continuity, dissolved, were absorbed, or otherwise exited before measurement are absent from any future calibration set.

**Manifestation in OCI.** When v2 calibration begins, the longitudinal dataset will systematically over-represent institutions whose continuity practices were good enough to keep the institution measurable. The fit will reflect what worked for survivors, not what failed for non-survivors.

**v1 mitigation.** v1.0.0 does not perform empirical calibration; this risk does not materialise yet. The §0 disclosure makes the absence of calibration explicit.

**v2 mitigation roadmap.** The empirical calibration plan (§14) will explicitly include retrospective case studies of institutional-continuity failures alongside the opted-in operating panel. Calibration will be reported as conditional on the survivor population unless and until the case-study work allows a broader claim.

**Residual risk.** Survivorship bias cannot be eliminated; it can only be acknowledged. Even with retrospective case studies, the dataset will under-represent the population of failed institutions. The methodology accepts this residual risk and surfaces it in the v2 disclosure rather than concealing it.

### 11.5.2 Respondent interpretation variance

**Definition.** Workbook responses are language-dependent. The phrase "successor identified" can mean different things to different reviewers: a formally appointed deputy, an informally acknowledged understudy, or a colleague who happens to know the work.

**Manifestation in OCI.** Two reviewers carrying out the same Stewardship Density Index™ exercise on the same institution may produce different `successorIdentified` flags for the same carrier, yielding different index values.

**v1 mitigation.** The methodology's definitions are documented in the framework source files and restated here in §6. The facilitator training curriculum ([docs/oci/OCI_FACILITATOR_TRAINING_CURRICULUM.md](../OCI_FACILITATOR_TRAINING_CURRICULUM.md)) covers definitional consistency. The observable-criteria files for the Governance Entropy Scale™ (§8) reduce interpretation variance for that framework by specifying auditor checks.

**v2 mitigation roadmap.** Observable-criteria files will be authored for the other four frameworks at v1.1.0. Inter-reviewer agreement studies are planned at v2.0.0.

**Residual risk.** Even with explicit definitions and observable criteria, some interpretation variance is irreducible. The methodology accepts this and pairs every classification with a posture statement that the reviewer can amend if the classification does not match the institutional context.

### 11.5.3 Incomplete stewardship visibility

**Definition.** Shadow stewards, undocumented continuity carriers, and informal knowledge holders are systematically under-counted in the inputs to the Stewardship Density Index™.

**Manifestation in OCI.** The index will systematically *understate* concentration when the institution has substantial shadow stewardship: the documented carriers appear well-distributed because the undocumented carriers are absorbing load invisibly.

**v1 mitigation.** The discovery sessions in Phase 2 (Mapping) are explicitly designed to surface shadow stewardship. The facilitator's discovery prompts (under the Institutional Discovery Framework) ask about informal continuity carriers. The methodology documents this risk in the discovery curriculum.

**v2 mitigation roadmap.** A "shadow stewardship adjustment" coefficient is on the v2 calibration roadmap, anchored to the difference between facilitator-elicited shadow-steward counts and institution-documented steward counts across the opted-in panel.

**Residual risk.** No methodology can elicit stewardship that the institution itself cannot see. The methodology accepts this floor and surfaces it as a caution in any density classification that may be affected.

### 11.5.4 Organisational self-reporting distortion

**Definition.** Institutions tend to under-report governance entropy and over-report successor readiness. The distortion is the classical social-desirability bias adapted to institutional self-reporting.

**Manifestation in OCI.** Governance Entropy classifications tend toward the more coherent end of the scale; Stewardship Density classifications tend toward the more distributed end of the bands. Both biases push the methodology's outputs toward optimism.

**v1 mitigation.** The reviewer-led principle (§4.6) is the structural mitigation: a facilitator reading the institution alongside the institutional self-report applies a calibration the institution alone cannot. The observable-criteria files (§8) provide auditor checks the reviewer can apply against documents rather than against institutional narrative.

**v2 mitigation roadmap.** A "facilitator calibration adjustment" coefficient is on the v2 roadmap, anchored to the gap between facilitator-assessed and institution-self-reported classifications across the opted-in panel.

**Residual risk.** Self-reporting distortion is irreducible. The methodology accepts the residual and warns reviewers in the facilitator training curriculum that institutional self-reports are inputs to interpretation, not the interpretation itself.

### 11.5.5 Facilitator influence

**Definition.** Facilitated Edition outputs are partly a function of facilitator skill. The same institution may produce different classifications under different facilitators.

**Manifestation in OCI.** Two facilitators carrying out the same engagement on the same institution may produce different Stewardship Density Index™ inputs (different shadow-steward elicitations, different criticality classifications) and therefore different framework outputs.

**v1 mitigation.** The facilitator certification rubric ([docs/oci/OCI_FACILITATOR_CERTIFICATION_RUBRIC.md](../OCI_FACILITATOR_CERTIFICATION_RUBRIC.md)) is the structural mitigation. Recertification on a stated cadence and after any reported doctrine-drift incident is the operational mitigation. Voice discipline (enforced through artefact-drafting review) reduces facilitator-to-facilitator variance in tone if not in substance.

**v2 mitigation roadmap.** Inter-facilitator agreement studies are planned at v2.0.0. The studies will examine the same opted-in institution under two independently certified facilitators and report the classification agreement.

**Residual risk.** Facilitator influence cannot be eliminated in a reviewer-led methodology; eliminating it would require automating the work the reviewer is there to do. The methodology accepts this residual and treats it as the price of the reviewer-led posture.

### 11.5.6 Temporal continuity drift

**Definition.** Institutional continuity posture changes faster than measurement cadence. v1.0.0 snapshots can lag reality by months.

**Manifestation in OCI.** A density classification produced in January may not reflect the institution's posture in June if a key carrier has departed in the interim. The Continuity Burden Map™ composite is particularly vulnerable because it composes three inputs each of which may drift independently.

**v1 mitigation.** Engagement scope documents specify the measurement window. Snapshots carry a `recorded_at` timestamp. Re-engagement is the operational mitigation.

**v2 mitigation roadmap.** A "measurement-currency caution" surfacing rule is planned at v1.1.0: unknown framework result older than a configured threshold (default 180 days) will be re-surfaced with an explicit currency caution.

**Residual risk.** Snapshot lag is a property of any measurement methodology that is not continuously sampled. Continuous sampling would conflict with the reviewer-led posture; the methodology accepts the lag and surfaces it in the v1.1.0 surfacing rule.

### 11.5.7 Governance documentation asymmetry

**Definition.** Well-documented institutions appear higher-entropy because their drift is *visible*. Poorly-documented institutions appear coherent because nobody can see the gaps.

**Manifestation in OCI.** The Governance Entropy Scale™ can systematically misclassify under-documented institutions as more coherent than they are, simply because the precedents that would surface drift are missing.

**v1 mitigation.** The observable criteria for Level 5 (systemic_entropy) include `L5-PV-01-decisions-opaque` ("More than 50% of governance decisions cannot be reconstructed without extensive interviewing") and `L5-DOC-02-no-policy-source-of-truth`. These criteria explicitly catch the "appears coherent because invisible" pattern and push the classification toward the higher-entropy end of the scale.

**v2 mitigation roadmap.** A "documentation-coverage" prerequisite is planned for v1.1.0: classifications below a documented coverage threshold will be surfaced with an explicit "low documentation coverage" caution and the reviewer will be required to acknowledge it.

**Residual risk.** Documentation asymmetry is real and unevenly distributed across institutional sectors. The methodology accepts this and treats the documented Level 5 criteria as the primary structural mitigation.

### 11.5.8 Modernization-stage instability

**Definition.** Institutions mid-transition (a recent leadership change, a recent governance restructuring, a recent merger) produce unstable readings. The same metric on month 1 vs month 6 of a modernization can swing dramatically.

**Manifestation in OCI.** A Stewardship Density Index™ reading taken three months into a leadership transition will reflect transition turbulence rather than the institution's steady-state posture. A reading taken nine months in may be dramatically different without any underlying continuity change.

**v1 mitigation.** Engagement scoping under [docs/oci/OCI_PILOT_SCOPE_TEMPLATE.md](../OCI_PILOT_SCOPE_TEMPLATE.md) explicitly asks whether the institution is mid-transition and documents the answer. Reviewers carrying mid-transition engagements pair every classification with an explicit "transition-window" interpretive note.

**v2 mitigation roadmap.** A "transition-window" surfacing rule is planned at v1.1.0: classifications taken within a documented transition window will be re-surfaced with an explicit caution and the reviewer will be required to acknowledge it.

**Residual risk.** Some transitions are unrecognised until after the engagement; the methodology cannot caution against what neither the institution nor the reviewer can see. The methodology accepts this and treats post-engagement re-reads as the structural mitigation.

### 11.5.9 How OCI reports residual risk to consumers

The residual risk acknowledgements above are not buried in this whitepaper. The methodology surfaces them operationally:

- The PDF executive narrative carries a "Reading caveats" subsection that names the relevant risks for the engagement.
- The interpretive caution states (§7.2) carry posture sentences that name the relevant risk.
- The reviewer's interpretive note attached to every framework classification is the place where engagement-specific residual risk is named for the institution.

The methodology refuses the alternative — concealing the residual risks to make the outputs look more authoritative than they are. Concealment would violate the recognition-precedes-diagnosis principle (§4.1) and the honest-deferral principle (§4.9).

---

## §12 Standards positioning

The methodology operates within a landscape of widely-cited governance, continuity, and risk standards. Institutional reviewers must be able to position OCI within that landscape. This section names the relationships explicitly.

The relationships use four classes:

- **Complements.** OCI adds an interpretive layer alongside the standard. Institutions can carry both.
- **Extends.** OCI carries the standard's concern further into institutional continuity terrain.
- **Gap-coverage.** OCI addresses ground the standard does not cover.
- **Not-equivalent.** Surface similarity only; the two are doing different work and should not be substituted.

These four classes govern the standards-substitutability positioning in §12.1–§12.11. A fifth class, **structurally-consistent**, is used only in §12.12 for *measurement-tradition lineage* (a distinct question — whether self-assessed capability is a recognized evidence form — not a substitutability claim).

OCI is **never described as "equivalent to"** any of the standards below. The full crosswalk by clause is in [standards-crosswalk.yaml](standards-crosswalk.yaml).

### 12.1 ISO 22301:2019 — Business Continuity Management Systems

**Relationship: complements.** ISO 22301 governs the management system that prepares an institution for disruptive events (a fire, a system outage, a pandemic). The OCI Method™ governs the slowly-moving stewardship and governance-lineage exposures that produce continuity failure *absent* any disruptive event. Institutions running ISO 22301 can adopt OCI alongside it without conflict. OCI does not certify against ISO 22301 and is not a BCMS.

Specific overlaps:

- **OCI Stewardship Density Index™ ↔ ISO 22301 Annex A (resource analysis).** The SDI adds the carrier-concentration reading that ISO 22301 leaves implicit. **Complements.**
- **OCI Continuity Burden Map™ ↔ ISO 22301 Clause 8.2 (business impact analysis).** ISO 22301's BIA enumerates impact; the burden map adds who is carrying the load. **Extends.**
- **OCI Reconstruction Burden Index™ ↔ ISO 22301 Clause 8.3 (recovery strategies).** Recovery strategies presume the institution can reconstruct; OCI surfaces the cost of doing so. **Complements.**

### 12.2 ISO 22317:2021 — Business Impact Analysis Guidelines

**Relationship: complements.** ISO 22317 standardises how impact is named. OCI standardises how stewardship and continuity-lineage exposures are named. The two vocabularies are non-overlapping.

### 12.3 ISO 37000:2021 — Governance of Organizations

**Relationship: complements.** ISO 37000 articulates governance principles at the institutional level. The Governance Entropy Scale™ measures the drift between an institution's governance precedents and its governance practice — a measurement layer ISO 37000 does not specify.

Specific overlap:

- **OCI Governance Entropy Scale™ ↔ ISO 37000 Principle 5 (accountability) and Principle 9 (performance).** Both principles assume governance design is being practised; entropy measures the gap. **Extends.**

### 12.4 ISO 31000:2018 — Risk Management Guidelines

**Relationship: complements.** ISO 31000 treats risk as an event to be identified, analysed, evaluated, and treated. OCI treats continuity exposure as a slowly compounding structural fact. Both vocabularies can be carried together; neither substitutes for the other.

### 12.5 COBIT 2019 — Governance Framework for Enterprise IT

**Relationship: not-equivalent.** COBIT addresses enterprise IT governance. OCI addresses institutional continuity governance. Surface similarity (both speak of "governance") should not be read as substitutability. An institution may run both, but COBIT cannot be used as evidence of OCI practice and vice versa.

### 12.6 NIST SP 800-34 Rev.1 — Contingency Planning Guide

**Relationship: not-equivalent.** NIST SP 800-34 covers IT contingency planning for federal information systems. OCI covers institutional-knowledge continuity independent of any IT system. Inclusion of NIST in OCI training reading lists is appropriate; substitution is not.

### 12.7 DDI — Leadership Continuity / Succession Planning Methodologies

**Relationship: complements.** DDI methodology identifies and develops individual successor leaders. OCI measures institutional exposure when successors are absent. Both vocabularies can run side-by-side; the OCI Method™ explicitly excludes individual successor assessment (anti-surveillance position).

### 12.8 Korn Ferry — Succession Management Architecture

**Relationship: complements.** Korn Ferry treats succession as a talent-planning architecture. OCI treats stewardship density and governance entropy as institutional readings independent of talent assessment. The two perspectives are orthogonal.

### 12.9 OECD Principles of Corporate Governance (2023)

**Relationship: complements.** The OECD principles operate at the principle-statement level. OCI operates at the institutional-measurement level. There is no overlap to deconflict; the principles inform sponsor recognition conversations in Phase 1.

### 12.10 CMMI — Capability Maturity Model Integration

**Relationship: not-equivalent.** CMMI measures process-capability maturity along a five-level scale. The Governance Entropy Scale™ also has five ordinal levels. The coincidence is structural, not semantic; OCI levels measure governance-design-to-practice drift, not process capability. This document does not describe the OCI scale as a "maturity model" without immediate disambiguation, and the [standards-crosswalk.yaml](standards-crosswalk.yaml) records the not-equivalent relationship explicitly.

### 12.11 HHI and Gini

**Relationship: not-equivalent.** The Herfindahl–Hirschman Index sums squared market shares to measure market concentration. The Gini coefficient measures inequality across a population. The Stewardship Density Index™ is a weighted exposure ratio, not a sum of squares and not a Lorenz-curve construction. Surface similarity (concentration framing, inequality framing) should not produce equivalence claims.

### 12.12 Measurement-tradition positioning — self-assessed capability as evidence

The preceding subsections position OCI against governance, continuity, and risk *standards* (a substitutability question). This subsection answers a different and deeper reviewer question — a **measurement-theory lineage** question: *is it legitimate, in established assessment practice, to treat self-assessed capability as evidence at all?* The Construct Invariant (§4.6) admits `likert_5` self-assessment as the weakest evidence tier of the continuity construct; §7.6 bounds and subordinates it. This subsection shows the *pattern* — self-assessed capability counted as one form of evidence — is well established beyond OCI doctrine, so that the admission rests on recognized practice rather than on OCI's say-so alone.

This is **lineage positioning, not derivation and not validation**. OCI does not adopt the instruments, scoring, or empirical claims of any tradition below; it does not assert that its coefficients inherit their validation (the v1.0.0 maturity disclosure in §0 and §4.5 still governs). The relationship class is **structurally-consistent**: the named traditions establish that admitting self-report as a bounded evidence form is normal assessment practice, and OCI's treatment is *more conservative* than most, because it (a) caps self-assessment to a minority weight, (b) subordinates it to behavioral evidence, and (c) cross-checks it with downward-only contradiction detection (§7.6).

| Established tradition | Where self-assessed capability is treated as evidence | OCI's relationship |
|---|---|---|
| **Self-efficacy** (the perceived-capability construct associated with Bandura) | Perceived capability is measured as a predictor of performance in its own right. | **Structurally-consistent.** OCI treats perceived recoverability as one (weakest) evidence tier — but, unlike pure self-efficacy measurement, never as the dominant or sole signal. |
| **Organizational readiness for change** (the collective-readiness construct associated with Weiner) | Organizations self-rate collective capability and commitment as a measured readiness signal. | **Structurally-consistent.** OCI's confidence signals sense collective continuity readiness; OCI subordinates them to behavioral maturity evidence. |
| **Safety climate / safety culture instruments** (the perception-survey tradition associated with Zohar) | Self-reported perceptions of safety are accepted evidence in safety-critical domains. | **Structurally-consistent.** OCI uses perception as a sensing layer in a continuity-critical domain, with the same "perception ≠ proof" caution these instruments observe. |
| **Control self-assessment (CSA)** (a recognized internal-audit practice, e.g. IIA guidance) | Process owners self-assess control effectiveness as audit-relevant evidence, subject to corroboration. | **Structurally-consistent — and closest in spirit.** Auditors themselves treat self-assessment as evidence *that must be corroborated*. OCI's contradiction engine is exactly that corroboration discipline. |
| **Organizational resilience self-assessment** (the self-assessment of resilience attributes in the ISO 22316 tradition) | Resilience attributes are partly assessed through structured organizational self-assessment. | **Structurally-consistent.** OCI reads continuity (a resilience-adjacent construct) partly through structured self-assessment, bounded as the weakest tier. |

The honest summary for a procurement reviewer: **OCI did not invent the idea that self-assessed capability is evidence.** Treating self-report as a bounded, corroborated evidence form is standard across self-efficacy research, organizational-readiness measurement, safety-climate instruments, internal-audit control self-assessment, and organizational-resilience self-assessment. OCI's contribution is not the idea but the *discipline* around it: self-assessment is admitted only as the weakest evidence tier, capped to a minority weight, subordinated to behavioral evidence, and actively cross-checked for contradiction. The corresponding rows are recorded in [standards-crosswalk.yaml](standards-crosswalk.yaml) under `measurement_traditions`, using the `structurally-consistent` relationship class (distinct from the substitutability classes used for standards).

### 12.13 Summary positioning

OCI sits in the **stewardship-and-continuity-governance** layer that none of the listed standards directly occupies. ISO 22301 occupies the disruption-response layer; ISO 37000 occupies the governance-principles layer; COBIT occupies the enterprise-IT-governance layer; CMMI occupies the process-capability-maturity layer. OCI's contribution is a measurement methodology for the slowly-moving institutional fact that continuity is held by a small number of stewards whose load is not yet named.

---

## §13 Doctrine governance

The methodology is itself governed. This section names the governance.

### 13.1 Versioning

The methodology surface is versioned independently of the codebase. The version number tracks the doctrine surface. The current version is v1.0.0. Versioning follows semantic-version conventions: major versions denote constitutional changes; minor versions denote standard-class changes that may break consumer assumptions; patch versions denote clarifications.

### 13.2 Change classes

[METHODOLOGY_CHANGELOG.md](METHODOLOGY_CHANGELOG.md) records every change to the methodology surface under one of three classes:

- **Constitutional.** Alters the doctrine surface itself. Requires coordinated amendment per [docs/oci/OCI_METHOD.md](../OCI_METHOD.md) §13.
- **Standard.** Alters a coefficient, threshold, observable, or crosswalk cell. Requires reviewer endorsement.
- **Clarification.** Non-substantive prose or formatting change. Logged for traceability but does not require endorsement.

### 13.3 Amendment authority

Methodology amendments are authorised by the OCI doctrine maintainers, recorded in the repository's [CODEOWNERS](../../../CODEOWNERS) file for `docs/oci/`. Amendments are recorded in the changelog with date, change class, summary, rationale, authority, breaking-change flag, and affected artifacts list.

### 13.4 Audit gates

Publication of this document is gated by an internal-consistency audit. The audit verifies:

1. Every coefficient mentioned in §6 equals the value in the live framework source file.
2. Every coefficient carries a `derivation_status` tag in [coefficient-registry.yaml](coefficient-registry.yaml) matching the §4.5 taxonomy.
3. At v1.0.0, zero coefficients claim a `derivation_status` of `sector-anchored`, `empirically-calibrated`, or `externally-validated`.
4. Trademark usage carries the ™ symbol on first mention per section.
5. No term from [forbidden-vocabulary.ts](../../../apps/union-eyes/tooling/marketing/config/forbidden-vocabulary.ts) appears in this document in a context that would be flagged on a public marketing surface. (The vocabulary file is scoped to public marketing surfaces; doctrine documents may reference the vocabulary itself, and may use standards-cited terms such as "disruption" when describing ISO 22301's response domain.)
6. No anti-overclaim language (`empirically validated`, `proven`, `certified`, `peer-reviewed` against v1 weights) appears.
7. No standards-equivalence language (`equivalent to ISO ...`, `ISO-equivalent`, `COBIT-equivalent`) appears.
8. Every internal reference to `docs/oci/*` resolves to a file that exists.
9. Every formula in §6 is reconstructible from the prose above it. No symbolic notation appears without immediate operational interpretation. No coefficient is rendered with more decimal precision than its registry value.
10. §11.5 enumerates the eight known methodological risks with the full schema (definition / manifestation / v1 mitigation / v2 roadmap / residual).
11. [METHODOLOGY_CHANGELOG.md](METHODOLOGY_CHANGELOG.md) contains the founding entry and references every companion artifact created at v1.0.0.

Failure of any audit check is a publication blocker. The audit is executed manually for v1.0.0; automation is planned for v1.1.0.

### 13.5 Doctrine drift incidents

A doctrine drift incident is an observed gap between the methodology specification (this document and its companion artifacts) and an implementation that consumes it. Drift incidents are recorded, triaged, and resolved by either updating the implementation to match the methodology or by amending the methodology to formalise the implementation. Resolution is recorded in the changelog under the appropriate class.

---

## §14 Roadmap to v2 (empirical calibration)

v2.0.0 is the methodology version at which one or more coefficients advance to Sector-Anchored, Empirically-Calibrated, or Externally-Validated maturity. This section names the work that is required.

### 14.1 Pre-conditions

The following must be in place before any v1 coefficient can advance:

- An opted-in longitudinal dataset of at least twenty institutions across at least three sectors, contributing under the k-anonymity threshold of five institutions per published band.
- A documented fit procedure for each coefficient under consideration, including the choice of dependent variable, the fit method, the sample size, and the confidence reporting.
- An independent audit of the fit procedure by a reviewer not affiliated with the OCI doctrine maintainers.

### 14.2 Calibration priority

The coefficients prioritised for v2 calibration are those that the sensitivity analysis (§10) identifies as load-bearing: the SDI band thresholds (`DENSITY_BANDS.critical.lowerBound`, `fragile.lowerBound`), the GES level thresholds, and the CBM `DENSITY_WEIGHT`. The RBI's `density_multiplier` is the next priority.

### 14.3 Calibration is conditional

Advancement is conditional on the calibration evidence supporting the v1 value within a reasonable tolerance. If the calibration evidence indicates a materially different value, the v2 coefficient takes the calibrated value and the changelog records the change with the empirical justification.

### 14.4 What v2 will not do

v2 will not move the methodology from reviewer-led to model-led. The frameworks will remain deterministic, reviewer-led, and bounded by the AI Boundary. Empirical calibration is an evidence layer added beneath the methodology; it does not replace the reviewer-led posture.

### 14.5 v1.1.0 work

The interim version v1.1.0 will:

- Author observable-criteria files for the other four frameworks (SDI, CBM, CSM, RBI).
- Translate this document into French with terminology lock.
- Add "measurement-currency caution" and "transition-window caution" surfacing rules (§11.5.6, §11.5.8).
- Add a "low documentation coverage" caution for the GES (§11.5.7).
- Automate the §13.4 audit gates.

v1.1.0 does not change any coefficient values or maturity classifications.

---

## §15 AI boundary as applied to the method

The [OCI AI Boundary](../OCI_AI_BOUNDARY.md) is constitutive of the methodology. This section restates the four standing rules and names how each applies to the framework outputs documented above.

### 15.1 The four standing rules

1. **Reasoning is reviewer-led.** Every AI-assisted output is read, interpreted, and endorsed by a human reviewer before it informs any institutional decision.
2. **There is no autonomous decisioning.** No AI surface concludes on behalf of the institution. No AI surface acts on behalf of the institution.
3. **There is no behavioural inference.** No model is used to characterise, score, profile, or predict an individual's conduct, performance, or attention.
4. **There is no inference about non-consented subjects.** The institution's members, employees, and counterparts are not modelled.

### 15.2 Application to the framework outputs

- The five frameworks documented in §6 are **deterministic, not AI-driven**. They produce the same output for the same inputs every time. AI is not used to compute the framework values.
- AI assists the reviewer in **interpreting** the framework outputs (drafting the institutional reading note, suggesting language for the executive narrative, surfacing precedent cross-references) under the AI Boundary's bounded uses.
- AI is not used to characterise the carriers whose load the SDI surfaces. The framework code does not pass carrier identifiers or free-text notes to any AI surface.
- AI is not used to predict whether a fragile classification will produce a continuity failure. Such prediction would constitute behavioural inference about the carriers and is prohibited.

### 15.3 AI unavailability

If the AI surface is unavailable for any reason, the framework outputs are unaffected. The frameworks compute deterministically without AI assistance. The reviewer drafts manually. The institution's continuity work is not paused. AI accelerates the reviewer; it does not constitute the framework.

---

## §16 Closing

This document is the methodology specification for the OCI Method™ at version 1.0.0. It is published rather than concealed because the methodology is more useful to a procurement reviewer, a governance auditor, and an academic reviewer when its coefficients, its limitations, and its known risks are visible.

The methodology surface is honest about its maturity (§0, §4.5). It is auditable (§13.4). It is positioned against the standards landscape without claiming equivalence (§12). It enumerates its known risks (§11.5). It names its roadmap (§14).

The work documented here is the work of converting a multi-year institutional practice into a publication-grade methodology. The conversion is the precondition for OCI to operate within governance environments that require methodology specifications of this shape.

The next version of this document (v1.1.0) will extend observable criteria to the remaining four frameworks, translate the document into French with terminology lock, add the cautioning surfacing rules described in §11.5, and automate the §13.4 audit gates. The version after that (v2.0.0) will advance one or more coefficients to a higher maturity state, contingent on the empirical work described in §14.

Until then, the methodology stands as documented: a reviewer-led practice supported by deterministic frameworks whose coefficients are theory-informed operational weights, honestly disclosed.

---

## Appendices

### Appendix A — Glossary

A selection of doctrine-canonical terms used in this document. Full term definitions are recorded in the canonical sources cited in §3.

- **Continuity carrier.** A steward who carries operational or governance load whose loss would produce continuity impact.
- **Continuity Debt™.** Accumulated unstabilised continuity exposure; canonical definition in [docs/oci/stabilization/OCI_CONTINUITY_DEBT.md](../stabilization/OCI_CONTINUITY_DEBT.md).
- **Continuity exposure.** The structural fact that institutional continuity depends on a configuration of stewards, lineage, and governance the institution has not yet named.
- **Doctrine version.** The version of the OCI doctrine surface; v1.0.0 at first publication.
- **Engagement.** A scoped delivery of the method to a specific institution.
- **Facilitator.** A certified practitioner who delivers the method under the certification rubric.
- **Governance entropy.** Drift between governance design and governance practice.
- **Honest deferral.** Recognised inability to stabilise an item within the engagement, named with the reason.
- **Institutional reading.** The Recognition-phase artifact that records the institution's own terms.
- **Methodology surface.** This document and its companion artifacts.
- **Posture statement.** The institutionally-meaningful prose accompanying a framework value.
- **Reductive stabilization.** Stabilization that reduces fragility without shifting load to less senior or less recognised stewards.
- **Reviewer.** A named human who reads, interprets, and endorses a framework output on the institution's behalf.
- **Stewardship.** Recognised institutional responsibility for continuity carriers.
- **Stewardship density.** Concentration of stewardship across recognised continuity carriers.
- **Successor readiness.** The institution's preparedness for the transition of a continuity carrier.

### Appendix B — Cell table (CSM)

The full nine-cell table for the Continuity Survivability Matrix™ (§6.4).

| Dependency | Successor | Cell ID | Label |
| --- | --- | --- | --- |
| singular | absent | `singular_absent` | Continuity break imminent on transition |
| singular | in_progress | `singular_in_progress` | Stabilizing — succession underway |
| singular | identified | `singular_identified` | Stabilized — succession identified |
| concentrated | absent | `concentrated_absent` | Fragile concentration |
| concentrated | in_progress | `concentrated_in_progress` | Concentration improving |
| concentrated | identified | `concentrated_identified` | Concentrated but covered |
| distributed | absent | `distributed_absent` | Distributed without lineage |
| distributed | in_progress | `distributed_in_progress` | Distributed and stabilizing |
| distributed | identified | `distributed_identified` | Distributed and covered |

### Appendix C — Observable-criteria file index

| Ordinal | Level ID | Observable criteria file |
| --- | --- | --- |
| 1 | coherent | [observable-criteria/entropy-1.yaml](observable-criteria/entropy-1.yaml) |
| 2 | recognised_drift | [observable-criteria/entropy-2.yaml](observable-criteria/entropy-2.yaml) |
| 3 | patterned_drift | [observable-criteria/entropy-3.yaml](observable-criteria/entropy-3.yaml) |
| 4 | institutional_drift | [observable-criteria/entropy-4.yaml](observable-criteria/entropy-4.yaml) |
| 5 | systemic_entropy | [observable-criteria/entropy-5.yaml](observable-criteria/entropy-5.yaml) |

### Appendix D — Sensitivity scenarios index

The 25 sensitivity scenarios are documented in [sensitivity/scenarios.yaml](sensitivity/scenarios.yaml).

| Framework | Scenario IDs |
| --- | --- |
| Stewardship Density Index™ | `sdi-01-healthy-mid-size`, `sdi-02-concentration-emerging`, `sdi-03-critical-concentration`, `sdi-04-empty-institution`, `sdi-05-junior-cohort` |
| Governance Entropy Scale™ | `ges-01-coherent`, `ges-02-recognised-drift`, `ges-03-patterned-drift`, `ges-04-institutional-drift`, `ges-05-systemic-entropy` |
| Continuity Burden Map™ | `cbm-01-all-three-components-low`, `cbm-02-density-dominant`, `cbm-03-all-three-components-high`, `cbm-04-missing-secondary-inputs`, `cbm-05-perturbation-sensitivity` |
| Continuity Survivability Matrix™ | `csm-01-singular-absent`, `csm-02-distributed-identified`, `csm-03-concentrated-in-progress`, `csm-04-unknown-enum-falls-back-to-worst-case`, `csm-05-distributed-absent` |
| Reconstruction Burden Index™ | `rbi-01-minimal-burden`, `rbi-02-moderate-burden`, `rbi-03-substantial-burden`, `rbi-04-severe-burden`, `rbi-05-missing-entropy-default` |

### Appendix E — Cross-reference index

Quick map of methodology-specification anchors to their canonical-doctrine equivalents.

| §-anchor | Canonical doctrine source |
| --- | --- |
| §0 maturity disclosure | [coefficient-registry.yaml](coefficient-registry.yaml) `derivation_status` fields |
| §4 method principles | [docs/oci/OCI_METHOD.md](../OCI_METHOD.md) §3 |
| §4.5 maturity classification | This document (constitutional anchor) |
| §6 framework details | [apps/union-eyes/lib/oci/frameworks/](../../../apps/union-eyes/lib/oci/frameworks/) |
| §7 confidence model | [sample-size-policy.yaml](sample-size-policy.yaml) |
| §8 observable criteria | [observable-criteria/](observable-criteria/) |
| §11.5 known risks | This document (constitutional anchor) |
| §12 standards positioning | [standards-crosswalk.yaml](standards-crosswalk.yaml) |
| §13 doctrine governance | [METHODOLOGY_CHANGELOG.md](METHODOLOGY_CHANGELOG.md) |
| §15 AI boundary | [docs/oci/OCI_AI_BOUNDARY.md](../OCI_AI_BOUNDARY.md) |

### Appendix F — Forbidden vocabulary policy

The methodology surface uses an editorial register that excludes vocabulary which would misrepresent the work. The exclusion list is enforced programmatically by [apps/union-eyes/tooling/marketing/config/forbidden-vocabulary.ts](../../../apps/union-eyes/tooling/marketing/config/forbidden-vocabulary.ts). The list covers approximately 200 terms across the categories transformation, productivity, optimization, automation, behavioural-inference, scoring, surveillance, disruption, modernization-as-virtue, and flattening-marketing. Audit gate §13.4 verifies that no forbidden term appears in this document.

### Appendix G — Bibliography

Real, publicly-cited sources only. The methodology does not fabricate citations.

- ISO 22301:2019 — Business Continuity Management Systems — Requirements.
- ISO 22317:2021 — Business Continuity Management — Guidelines for Business Impact Analysis.
- ISO 37000:2021 — Governance of Organizations — Guidance.
- ISO 31000:2018 — Risk Management — Guidelines.
- ISACA — COBIT 2019 Framework: Governance and Management Objectives.
- NIST SP 800-34 Rev.1 — Contingency Planning Guide for Federal Information Systems.
- OECD — G20/OECD Principles of Corporate Governance (2023).
- Development Dimensions International (DDI) — Succession Planning methodology materials (public-facing).
- Korn Ferry — Succession Management Architecture materials (public-facing).
- CMMI Institute — CMMI for Development, v2.0 (overview materials).
- OCI doctrine bundle: [docs/oci/](../).

### Appendix H — Trademark notice

The following are trademarks asserted by the OCI doctrine maintainers and used institutionally within this document:

- OCI Method™
- Stewardship Density Index™
- Governance Entropy Scale™
- Continuity Burden Map™
- Continuity Survivability Matrix™
- Reconstruction Burden Index™
- Methodological Maturity Classification™
- Continuity Debt™
- Governance Entropy Workbook™
- Stewardship Redistribution Framework™
- Governance Survivability Recovery™
- Continuity-Aware Onboarding Stabilization™

Trademark assertion is institutional. The names denote specific OCI artifacts and should not be re-used to describe non-OCI work.

### Appendix I — Author attribution and acknowledgements

This methodology specification is the synthesis of an existing OCI doctrine corpus and a reviewer-informed framework practice. The document is owned and maintained by the OCI doctrine maintainers recorded in [CODEOWNERS](../../../CODEOWNERS) for `docs/oci/`. Drafting acknowledgements and review attribution are recorded in [METHODOLOGY_CHANGELOG.md](METHODOLOGY_CHANGELOG.md).

### Appendix J — How to read this document if you have thirty minutes

Read in this order:

1. **§0 Methodology Maturity Disclosure** — what OCI v1.0.0 is and is not.
2. **§5 Framework overview** — the one-line role of each framework.
3. **§4.5 Methodological Maturity Classification™** — how every coefficient is honestly classified.
4. **§11 Limitations and §11.5 Known methodological risks** — what the methodology refuses to claim.
5. **§12 Standards positioning** — how OCI sits beside ISO 22301, ISO 37000, COBIT, etc.

This reading path is sufficient to evaluate whether OCI belongs in your institution's procurement consideration set. The remaining sections supply the technical detail that supports the position.

---

# Operationalisation extensions (added under the Enterprise Defensibility & Statistical Governance Sprint)

> The following appendices extend v1.0.0 with runtime infrastructure and statistical anchoring. They are normative for any OCI consumer that wishes to claim **standards-traceable, confidence-aware, statistically contextualised, auditably reproducible, and operationally defensible** posture.

## Appendix K — Confidence Architecture (Universal Confidence Model™)

OCI v1.0.0 §7 introduced confidence as a categorical posture. This appendix specifies the runtime contract.

**Envelope.** Every framework output SHOULD be wrapped in a `ConfidenceEnvelope<TScore>` carrying:

- `score` — the framework's primary value;
- `confidence` — one of `HIGH | MODERATE | LOW | INSUFFICIENT`;
- `sampleSize`, `dataCompleteness`, `stability`, `decay`, `assessmentAgeDays`;
- `cautionStates` — drawn from the canonical caution vocabulary;
- `confidenceRationale` — a deterministic, replayable list of strings explaining the band.

**Composition rule.** Confidence is the minimum of: sample-size-based confidence, completeness-based confidence, stability-induced confidence, reviewer-variance-induced confidence, governance-evidence-induced confidence, after applying decay. Confidence is **never raised** by composition.

**Hard rule.** A confidence state is a categorical posture, never a probability.

Reference implementation: [`packages/oci-confidence/src/confidence-model.ts`](../../../packages/oci-confidence/src/confidence-model.ts).

## Appendix L — Evidence Sufficiency Doctrine (Evidence Sufficiency Engine™)

The Evidence Sufficiency Engine™ characterises whether observed evidence is sufficient for a Governance Entropy reading. Its outputs are:

- `sufficiency ∈ { sufficient, partial, insufficient }`;
- `confidence ∈ { high, moderate, low }`;
- `escalationRequired ∈ { true, false }`;
- `contradictionsDetected ∈ { true, false }`;
- `rationale` — ordered, replayable strings.

**Hard rule.** Governance Entropy MUST fail cautiously, NOT infer aggressively. Contradictions detected between strong observations downgrade the sufficiency from `sufficient` to `partial` even when the aggregate weight clears the sufficiency threshold.

**Verbal-only observations are never sufficient on their own.** This is enforced by the base-weight assignment in the Observable Evidence Taxonomy™.

Reference implementation: [`apps/union-eyes/lib/oci/audit/evidenceSufficiencyEngine.ts`](../../../apps/union-eyes/lib/oci/audit/evidenceSufficiencyEngine.ts).

## Appendix M — Audit Reproducibility (Entropy Audit Packet™)

Every Governance Entropy reading SHOULD be expressible as a content-addressed Entropy Audit Packet™:

- `entropyOrdinal ∈ { 1, 2, 3, 4, 5 }`;
- `observedEvidence`, `failedCriteria`, `uncertaintyStates`, `reviewerNotes`;
- `confidence`, `contradictoryEvidence`, `escalationFlags`, `continuityCautionStates`;
- `reproducibilityHash` — SHA-256 over the canonicalised inputs.

**Hard rule.** Two reviewers replaying the same observations produce identical hashes. Hash inputs are canonicalised by sorting observations by `(evidenceSource, evidenceType)` and by rounding numeric reviewer fields to four decimals.

Reference implementation: [`apps/union-eyes/lib/oci/audit/entropyAuditPacketBuilder.ts`](../../../apps/union-eyes/lib/oci/audit/entropyAuditPacketBuilder.ts).

## Appendix N — Crosswalk Operationalisation

OCI's standards positioning (whitepaper §12) is operationalised through the [`docs/oci/compliance/`](../compliance/) crosswalk set. Five clause-level crosswalks (ISO 22301, ISO/TS 22317, ISO 37000, ISO 31000, COBIT 2019) and a top-level [coverage matrix](../compliance/OCI_COVERAGE_MATRIX.md) classify each interaction as `FULL | PARTIAL | ADJACENT | OUT_OF_SCOPE`.

**Hard rules (procurement-grade).**

1. No crosswalk asserts equivalence with any cited standard.
2. No crosswalk claims OCI replaces certification.
3. Every PARTIAL row records (a) the OCI artefact produced, (b) the limitation, (c) the auditor validation logic, (d) the confidence implication.
4. `OUT_OF_SCOPE` is documented explicitly per crosswalk so that absence of coverage is never inferred to be a gap in OCI.

## Appendix O — Confidence Decay Schedule

Per OCI doctrine the temporal decay band for an assessment is:

| Age | Decay band | Confidence consequence |
|---|---|---|
| < 90 days | `NONE` | No reduction |
| 90–179 days | `MILD` | `HIGH` → `MODERATE` |
| 180–364 days | `MODERATE` | `HIGH`/`MODERATE` → `MODERATE`/`LOW` |
| ≥ 365 days | `SEVERE` | Any band collapses to `INSUFFICIENT` |

**Hard rule.** Decay never raises a confidence band; on `SEVERE` decay the envelope collapses to `INSUFFICIENT` regardless of all other inputs.

Reference implementation: [`packages/oci-confidence/src/confidence-decay.ts`](../../../packages/oci-confidence/src/confidence-decay.ts).

## Appendix P — Stability Modelling (Stability Engine™)

The Stability Engine™ composes six explicit volatility signals — `modernizationVolatility`, `governanceVolatility`, `onboardingInstability`, `stewardshipTurnover`, `continuityVariance`, `transitionTurbulence` — into a categorical `stabilityState ∈ { STABLE, TRANSITIONAL, VOLATILE, UNKNOWN }` and a `temporalConfidence ∈ { HIGH, MODERATE, LOW, INSUFFICIENT }`.

When no volatility signal is provided, `stabilityState = UNKNOWN` and `temporalConfidence = INSUFFICIENT`. The engine never infers stability from absence of evidence.

Reference implementation: [`packages/oci-confidence/src/stability-engine.ts`](../../../packages/oci-confidence/src/stability-engine.ts).

## Appendix Q — HHI Anchoring (Herfindahl-Hirschman Index)

For a population of bearers with non-negative weights `w_i` and total `W = Σw_i`, HHI is the sum of squared market shares `Σ(w_i/W)²`. Bounds: `HHI ∈ [1/n, 1]`. Scaled HHI ∈ `[0, 10000]` is provided for standards-language compatibility.

**Doctrine bands.**

| Band | Threshold (normalised) | Posture |
|---|---|---|
| `DISTRIBUTED` | < 0.10 | Continuity-favourable structure |
| `MODERATE` | 0.10 – 0.149 | Continuity readiness gap |
| `CONCENTRATED` | 0.15 – 0.249 | Continuity risk surface |
| `HIGHLY_CONCENTRATED` | ≥ 0.25 | Continuity fragility |

**Hard rule.** HHI contextualises OCI; it does NOT replace OCI interpretation. The narrative produced by the Stewardship Concentration Model™ NEVER ranks institutions and NEVER asserts misconduct.

Reference implementation: [`apps/union-eyes/lib/oci/statistics/calculateHHI.ts`](../../../apps/union-eyes/lib/oci/statistics/calculateHHI.ts).

## Appendix R — Gini Anchoring (Gini coefficient)

Computed on sorted weights `x_1 ≤ … ≤ x_n` as:

$$G = \frac{\sum_{i=1}^{n}\,(2i - n - 1)\,x_i}{n \cdot \sum_{i=1}^{n} x_i}$$

Bounds: `G ∈ [0, 1]`. Doctrine bands: `EVEN` (< 0.2), `UNEVEN` (0.2–0.39), `INEQUITABLE` (0.4–0.59), `EXTREME` (≥ 0.6).

**Edge cases.** `n = 0` → `G = 0`, confidence `INSUFFICIENT`, caution `SMALL_SAMPLE`. `n = 1` → `G = 0` (undefined; returned as zero with `INSUFFICIENT`).

**Hard rule.** Gini contextualises stewardship-burden asymmetry. It is never read as a misconduct finding or as an exploitation finding. Reviewer-led interpretation is required at `INEQUITABLE`+.

Reference implementation: [`apps/union-eyes/lib/oci/statistics/calculateGini.ts`](../../../apps/union-eyes/lib/oci/statistics/calculateGini.ts).

## Appendix S — Reviewer Variance Modelling (Reviewer Consistency Layer™)

Tracks `reviewerAgreement`, `entropyVariance`, `escalationRate`, `calibrationConfidence ∈ { HIGH, MODERATE, LOW, INSUFFICIENT }` across a reviewer cohort, plus a list of human-readable `indicators`.

**Hard rule.** Preserve reviewer-led interpretation while constraining methodological drift. The model never overrides a reviewer's classification; it only surfaces calibration signals for facilitators. Panels with fewer than three reviewers are reported as `INSUFFICIENT` calibration regardless of agreement.

Reference implementation: [`apps/union-eyes/lib/oci/audit/reviewerVarianceModel.ts`](../../../apps/union-eyes/lib/oci/audit/reviewerVarianceModel.ts).

## Appendix T — Sprint audit gates (additive to §13.4)

The Enterprise Defensibility Sprint introduces the following additive audit gates (numbered continuing §13.4 series):

12. **Confidence-envelope presence.** Every OCI framework output cited externally MUST be accompanied by a `ConfidenceEnvelope`.
13. **No raised confidence on composition.** A composition layer MUST NOT raise a child confidence band.
14. **Decay never raises confidence.** `applyDecay(band, decayBand)` MUST be monotonically non-increasing.
15. **HHI/Gini bounds invariants.** HHI ∈ [1/n, 1]; Gini ∈ [0, 1]. Violations are bugs, never doctrine adjustments.
16. **Verbal-only insufficiency.** Verbal-only evidence MUST NOT produce a `sufficient` verdict.
17. **Packet reproducibility.** Identical canonical inputs MUST produce identical `reproducibilityHash` values.
18. **No institutional ranking.** No statistical or audit output MAY emit an ordered ranking across institutions.
19. **Crosswalk anti-equivalence.** No crosswalk row may assert equivalence with any cited standard.
