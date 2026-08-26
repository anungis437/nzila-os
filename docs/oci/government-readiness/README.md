# OCI / OCRA Government Readiness Program

> **Status:** Blueprint — Architecture Review Only.
> **This program is documentation-only.** No migrations, code, or tests are
> introduced by these documents. They specify a target architecture and a
> validation strategy for review and decision.
>
> **Public-service front door.** The public-service-facing framing for this program
> is **CIVIC by Nzila** (see [`docs/public-service/civic-thesis.md`](../../public-service/civic-thesis.md))
> with **CLEAR** as its evidence-discipline articulation
> ([`docs/public-service/clear-method-canonical.md`](../../public-service/clear-method-canonical.md)).
> CIVIC/CLEAR are the first-touch language; everything below — dimensions, scoring core,
> obligation taxonomy, confidence envelope, source-instrument traceability, procurement
> readiness — is the authoritative technical/architectural expression of the same method.
> The cross-tree alignment is documented at [`docs/CIVIC_OCI_ALIGNMENT.md`](../../CIVIC_OCI_ALIGNMENT.md).

Public-sector-scrutiny evolution blueprint for the OCI/OCRA institutional-continuity
assessment ecosystem. The program is designing OCI/OCRA to be **defensible,
explainable, auditable, benchmarkable, and reviewable for procurement** in
public-sector use — **without** altering its deterministic scoring core and
**without** turning it into a sector-specific product. Whether those properties
are established *in practice* depends on the empirical, operational, legal, and
external-validation gates recorded in
[IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md).

## Central thesis

> OCI/OCRA's deterministic, fair, anti-surveillance core is already world-class.
> Government readiness is achieved by adding a **read-only traceability /
> obligation / consequence / confidence / explainability layer** above a **frozen
> core** — not by changing how scores are computed.

## Start here

1. **[Master Blueprint](./OCI_OCRA_GOVERNMENT_READINESS_MASTER_BLUEPRINT.md)** —
   the whole picture: current-state audit, government domains, target architecture,
   gap analysis, validation strategy, risks.
2. **[Architecture Decision](./GOVERNMENT_READINESS_ARCHITECTURE_DECISION.md)** —
   why we reject a "government overlay" and choose an additive layer.

## Documents

| Document | Phase | Purpose |
| --- | --- | --- |
| [Master Blueprint](./OCI_OCRA_GOVERNMENT_READINESS_MASTER_BLUEPRINT.md) | 5 + 12 + master | Consolidated audit, domains, target arch, validation strategy |
| [Architecture Decision](./GOVERNMENT_READINESS_ARCHITECTURE_DECISION.md) | 1 | Minimum-change decision; rejects sector overlay |
| [Policy Traceability](./OCI_OCRA_POLICY_TRACEABILITY_ARCHITECTURE.md) | 2 | Evidence → Finding → Obligation → Dimension → Consequence → Recommendation |
| [Obligation Taxonomy](./OCI_OCRA_OBLIGATION_TAXONOMY.md) | 3 | Seven canonical obligation classes + hierarchy + conflicts |
| [Confidence Architecture](./OCI_OCRA_CONFIDENCE_ARCHITECTURE.md) | 4 | Validate & evolve the existing confidence envelope |
| [Explainability Model](./OCI_OCRA_EXPLAINABILITY_MODEL.md) | 6 | Seven-answer reconstruction contract |
| [Consequence Model](./OCI_OCRA_CONSEQUENCE_MODEL.md) | 7 | Six consequence classes; "avoided consequences" |
| [Benchmark Governance](./OCI_OCRA_BENCHMARK_GOVERNANCE_REVIEW.md) | 8 | Cohort floors; safe vs unsafe claims — **publication guard implemented** (suppress-by-default cohort/form/honesty gate) |
| [Inter-Rater Reliability](./OCI_OCRA_INTER_RATER_RELIABILITY_MODEL.md) | 9 | IRR strategy, calibration — **measurement harness implemented** (κ/ICC/band-agreement + study verdicts), empirical study pending data |
| [Procurement Readiness](./OCI_OCRA_PROCUREMENT_READINESS_ASSESSMENT.md) | 10 | Five-archetype readiness, gaps, roadmap |
| [Source Instrument Traceability](./OCI_OCRA_SOURCE_INSTRUMENT_TRACEABILITY.md) | Phase G | Finding → Obligation → **Source Instrument → Citation**; evidence-gated, UNVERIFIED-by-default, validator-promoted; **+ catalogue governance** (lifecycle, role-gated versioning, jurisdiction selection, conflict handling) |
| [Assessor Certification & Governance Standard](./OCI_OCRA_ASSESSOR_CERTIFICATION_STANDARD.md) | Gap 2 | Five assessor levels, calibration gate (reuses IRR thresholds), recertification cadence, suspend-by-default standing |
| [Validation Binder](./OCI_OCRA_VALIDATION_BINDER.md) | Gap 3 | Single assembled evidence index — every claim mapped to its spec + executable test suite |
| [Sharpe Validation Protocol](./RICHARD_SHARPE_VALIDATION_PROTOCOL.md) | 11 | Senior public-sector validation protocol |
| [Internal Pre-Mortem — Hypothetical Reviewer Challenges](./INTERNAL_PRE_MORTEM_HYPOTHETICAL_REVIEWER_CHALLENGES.md) | 11 | *Internal red-team pre-mortem — not external validation* |

## Next steps — validation packet & implementation

The blueprint phase is complete. The next steps are the validator packet and a
tightly-scoped, additive-layer-only implementation plan with tests authored before
code.

| Document | Purpose |
| --- | --- |
| [Security & Data-Handling Brief](./SECURITY_AND_DATA_HANDLING_BRIEF.md) | Procurement-facing data posture: collected / not collected, residency, retention, access, anonymization, AI boundary, withdrawal/export/deletion, incident handling |
| [Evidence Manifest](./EVIDENCE_MANIFEST.md) | Commit SHA, artifact versions, reproducible fixture, and send-time protocol that binds the corpus to a specific state before any external send |
| [Richard Validation Packet](./richard-packet/RICHARD_VALIDATION_PACKET.md) | Internal working packet — one-page summary, one finding rendered through the seven-answer contract, five questions for Richard |
| [External-send package](./richard-packet/external-send/README.md) | The four files that actually leave the building: cover email, independent review brief, reviewer response form, evidence index. **`INTERNAL_PRE_MORTEM_HYPOTHETICAL_REVIEWER_CHALLENGES.md` is never included in an external send.** |
| [Validation Workbook](./richard-packet/VALIDATION_WORKBOOK.md) | Objective-by-objective worksheets, scenario battery, dispositions, sign-off |
| [Additive-Layer Implementation Plan](./implementation/ADDITIVE_LAYER_IMPLEMENTATION_PLAN.md) | The five implementation units (Finding, TraceabilityRecord, obligation data, consequence data, per-finding confidence), shapes, build order |
| [Non-Regression Test Specification](./implementation/NON_REGRESSION_TEST_SPECIFICATION.md) | Five invariants, tests-before-code: scores unchanged, obligation isolation, seven-answer completeness, no orphan recommendations, confidence floor — **implemented and green** (plus Phase G source-instrument traceability, catalogue governance, assessor governance, and Phase C inter-rater reliability suites; government-readiness suite now 88 tests across 10 files, full ICRA 541) |

## The non-negotiable freeze

These elements **must not change** under this program (enforced by the
backward-compatibility validation suite):

- Dimension / composite / maturity-band math
- Fairness rule (context → interpretation labels only, never numerics)
- Comparability invariant (one universal 0–100 scale; core questions always
  included)
- Anti-surveillance posture and the five-layer AI boundary
- Observatory privacy (opt-in, k-anonymity K=5, no rankings, refusal-first)

## What is added (all non-scoring, read-only over the core)

Obligation taxonomy · Finding artifact · per-finding evidence-fed confidence ·
consequence model · seven-answer explainability contract · **source-instrument
traceability (Finding → Obligation → Source Instrument → Citation, evidence-gated
and UNVERIFIED until validated)** · benchmark publication rules · inter-rater
reliability program.

## Source architecture references

Grounded in the shipped system: `apps/union-eyes/lib/icra/` (scoring, maturity,
adaptation, evidence-strength), `packages/oci-confidence/`, `apps/union-eyes/lib/oci/`
(benchmark, statistics, observatory ethics), and the doctrine in `docs/oci/`.
