# OCI / OCRA Government Readiness Program

> **Status:** Blueprint — Architecture Review Only.
> **This program is documentation-only.** No migrations, code, or tests are
> introduced by these documents. They specify a target architecture and a
> validation strategy for review and decision.

Government-grade evolution blueprint for the OCI/OCRA institutional-continuity
assessment ecosystem. The program makes OCI/OCRA **defensible, explainable,
auditable, benchmarkable, and procurement-ready** for public-sector use —
**without** altering its validated deterministic scoring core and **without**
turning it into a sector-specific product.

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
| [Procurement Readiness](./OCI_OCRA_PROCUREMENT_READINESS_ASSESSMENT.md) | 10 | Five-archetype readiness, gaps, roadmap || [Source Instrument Traceability](./OCI_OCRA_SOURCE_INSTRUMENT_TRACEABILITY.md) | Phase G | Finding → Obligation → **Source Instrument → Citation**; evidence-gated, UNVERIFIED-by-default, validator-promoted; **+ catalogue governance** (lifecycle, role-gated versioning, jurisdiction selection, conflict handling) |
| [Assessor Certification & Governance Standard](./OCI_OCRA_ASSESSOR_CERTIFICATION_STANDARD.md) | Gap 2 | Five assessor levels, calibration gate (reuses IRR thresholds), recertification cadence, suspend-by-default standing |
| [Validation Binder](./OCI_OCRA_VALIDATION_BINDER.md) | Gap 3 | Single assembled evidence index — every claim mapped to its spec + executable test suite |
| [Sharpe Validation Protocol](./RICHARD_SHARPE_VALIDATION_PROTOCOL.md) | 11 | Senior public-sector validation protocol |
| [Government Validation Report V1](./GOVERNMENT_VALIDATION_REPORT_V1.md) | 11 | Verdicts, pilots, objection register, dispositions |

## Next steps — validation packet & implementation

The blueprint phase is complete. The next steps are the validator packet and a
tightly-scoped, additive-layer-only implementation plan with tests authored before
code.

| Document | Purpose |
| --- | --- |
| [Security & Data-Handling Brief](./SECURITY_AND_DATA_HANDLING_BRIEF.md) | Procurement-facing data posture: collected / not collected, residency, retention, access, anonymization, AI boundary, withdrawal/export/deletion, incident handling |
| [Richard Validation Packet](./richard-packet/RICHARD_VALIDATION_PACKET.md) | One-page summary, one finding rendered through the seven-answer contract, five questions for Richard |
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
