# OCI / OCRA — Implementation Status Matrix (authoritative)

> **Purpose.** One authoritative, dated register of what is proposed, what is
> implemented, what is tested, what has been externally validated, and what has
> been empirically measured. This matrix **supersedes** any status wording in
> other OCI/OCRA government-readiness documents. Where another document
> conflicts with this matrix, this matrix is authoritative.
>
> **Status.** Living document. Every entry carries an explicit status token
> from the taxonomy below. External-facing status claims elsewhere in the
> corpus (packet, binder, security brief, procurement assessment, blueprints)
> are being reconciled against this matrix.
>
> **Read this before the packet.** If a claim elsewhere reads as stronger than
> the status recorded here, treat the claim as **stale** and file an issue.
>
> **As of:** 2026-07-20 · **Doctrine version:** 1.0.0

---

## Status taxonomy (the only tokens permitted in this matrix)

| Token | Meaning |
| --- | --- |
| `PROPOSED` | Designed on paper. No implementation exists. |
| `IMPLEMENTED` | Code exists that realises the design. Not necessarily executed on demand. |
| `INTERNALLY_TESTED` | Automated tests exist and are run in CI against the implementation. |
| `PROOF_RUN_VERIFIED` | Executed end-to-end against a documented fixture with recorded output. |
| `EXTERNALLY_VALIDATED` | Reviewed by a party independent of Nzila with recorded verdicts. |
| `EMPIRICALLY_MEASURED` | Real-world data collected against the property (e.g. IRR from paired reviewers, security test results from a qualified assessor). |

**Interpretation rule.** `INTERNALLY_TESTED` is **not** validation.
`IMPLEMENTED` is **not** procurement-grade. `PROOF_RUN_VERIFIED` is **not**
`EMPIRICALLY_MEASURED`. Do not use the token `validated` in prose to mean
`INTERNALLY_TESTED`.

---

## 1. Core scoring & determinism

| # | Property | Status | Evidence | Honest limit |
| --- | --- | --- | --- | --- |
| C1 | 5-dimension scoring engine | `INTERNALLY_TESTED` | [`scoring.ts`](../../apps/union-eyes/lib/icra/scoring.ts); ICRA test suite | Coefficients are practitioner-informed; not empirically calibrated |
| C2 | Maturity band resolver | `INTERNALLY_TESTED` | [`maturity.ts`](../../apps/union-eyes/lib/icra/maturity.ts) | — |
| C3 | Deterministic canonical scoring payload (byte-identical across runs) | `INTERNALLY_TESTED` | [`canonicalScoringPayload.ts`](../../apps/union-eyes/lib/icra/traceability/canonicalScoringPayload.ts); [`canonical-scoring-payload.test.ts`](../../apps/union-eyes/lib/icra/__tests__/government-readiness/canonical-scoring-payload.test.ts) | The *full* scoring outputs are **not** byte-identical (they include wall-clock `scoredAt`/`generatedAt`/`answeredAt`). Only the canonical payload — with timestamps excluded — is byte-identical. |
| C4 | Fairness: context changes labels, never numbers | `INTERNALLY_TESTED` | backward-compat suite; adaptation suites | — |
| C5 | Non-regression: additive layer never mutates trace | `INTERNALLY_TESTED` | `government-readiness/backward-compat-scores.test.ts` | — |

## 2. Additive government-readiness layer

| # | Property | Status | Evidence | Honest limit |
| --- | --- | --- | --- | --- |
| G1 | Finding artifact (7-answer contract) | `INTERNALLY_TESTED` | [`finding.ts`](../../apps/union-eyes/lib/icra/findings/finding.ts); [`finding-completeness.test.ts`](../../apps/union-eyes/lib/icra/__tests__/government-readiness/finding-completeness.test.ts) | Field-presence and PII-marker regex; not an independent causal reconstruction |
| G2 | Obligation taxonomy (7 classes) | `INTERNALLY_TESTED` | [`obligationTaxonomy.ts`](../../apps/union-eyes/lib/icra/obligations/obligationTaxonomy.ts); `obligation-mapping-isolation.test.ts` | Hierarchy is a reporting convention, not a universally authoritative legal ordering |
| G3 | Confidence envelope (ordinal, evidence-fed, min-band composition) | `INTERNALLY_TESTED` | [`@nzila/oci-confidence`](../../packages/oci-confidence); `confidence-evidence-floor.test.ts` | Threshold placement is practitioner-informed; not empirically calibrated |
| G4 | Consequence model | `IMPLEMENTED` | [`consequenceModel.ts`](../../apps/union-eyes/lib/icra/consequences/consequenceModel.ts) | Regression tests focused on chain integrity, not consequence-copy adequacy |
| G5 | Traceability record with version pinning (scoring, question bank, obligation, consequence, source-catalogue) | `INTERNALLY_TESTED` | [`traceabilityRecord.ts`](../../apps/union-eyes/lib/icra/traceability/traceabilityRecord.ts); `no-orphan-recommendations.test.ts` | Object-graph freezing is shallow at the top level; deep-immutability of nested arrays is not asserted (relies on `readonly` types + producer discipline) |
| G6 | No-orphan-recommendation invariant (surfaced-set variant) | `IMPLEMENTED` | `TraceabilityRecord.chainIntegrity.everySurfacedRecommendationHasFinding` (nullable when caller does not supply the surfaced set) | The rendered-report call sites do not yet pass the surfaced-recommendation set through; today the reported invariant proves *"every finding has a recommendation ref"*, not *"every rendered recommendation has a finding"*. That upgrade is `IMPLEMENTED` at the record layer and `PROPOSED` end-to-end. |
| G7 | Source-instrument catalogue | `IMPLEMENTED` (schema) · `PROPOSED` (verified content) | [`sourceInstruments.ts`](../../apps/union-eyes/lib/icra/obligations/sourceInstruments.ts); `source-instrument-*.test.ts` | Seed catalogue is entirely `UNVERIFIED` with generic placeholders (e.g. *"institution-specific enabling statute"*); no citation is defensible until real instruments, jurisdictions, dates, clauses, and applicability logic are populated and confirmed by qualified counsel. |
| G8 | Assessor certification & governance program | `PROPOSED` | [`OCI_OCRA_ASSESSOR_CERTIFICATION_STANDARD.md`](./OCI_OCRA_ASSESSOR_CERTIFICATION_STANDARD.md); `assessor-governance.test.ts` (tests the policy machinery, not a certified corps) | Zero certified assessors exist today. Calibration studies, gold-standard cases, and recertification cadence are policy-only. |
| G9 | Inter-rater reliability (IRR) machinery | `INTERNALLY_TESTED` (harness) · `PROPOSED` (measurement) | `inter-rater-reliability.test.ts`; [`OCI_OCRA_INTER_RATER_RELIABILITY_MODEL.md`](./OCI_OCRA_INTER_RATER_RELIABILITY_MODEL.md) | No empirical κ, ICC, or band-agreement value has been observed against a real reviewer panel |
| G10 | Benchmark publication guard (k-anonymity K=5, cohort minima, no rankings) | `INTERNALLY_TESTED` | [`publicationGuard.test.ts`](../../apps/union-eyes/lib/oci/benchmark/__tests__/publicationGuard.test.ts) | Programmatic enforcement is in place at the aggregation boundary. No benchmark has yet been published against a real cohort. |

## 3. Security, privacy, and data handling

| # | Property | Status | Evidence | Honest limit |
| --- | --- | --- | --- | --- |
| S1 | Persisted **scoring trace and finding structures** contain no direct personal identifiers by schema | `INTERNALLY_TESTED` | `finding-completeness.test.ts` (PII-marker regex over statements) | Regex covers `@`, `Mr.`, `Mrs.`, `email` shapes only. Does **not** cover names, phone numbers, employee ids, addresses, union positions, French honorifics, Indigenous identifiers, or small-cell identifiers. |
| S2 | Enum-only, PII-key-rejecting telemetry | `INTERNALLY_TESTED` | `adaptiveTelemetryPrivacyRegression.test.ts` | — |
| S3 | k-anonymity K=5 at the aggregation boundary | `INTERNALLY_TESTED` | `aggregateIntelligence.ts` | No published benchmark has exercised this in production yet |
| S4 | AI never scores, decides, routes, or profiles | `IMPLEMENTED` | import-graph isolation tests (obligations/consequences modules do not import the scoring engine) | — |
| S5 | Free-text `note` field on `Answer` | `IMPLEMENTED` (**not PII-safe**) | [`scoring.ts` `buildAnswer()`](../../apps/union-eyes/lib/icra/scoring.ts) accepts an optional `note?: string` and persists it on the answer | The security brief historically claimed *"no free-text narrative enters the scored or persisted path."* That claim is **incorrect** while `Answer.note` exists as a free-text field. See mitigation options in [SECURITY_AND_DATA_HANDLING_BRIEF.md §2](./SECURITY_AND_DATA_HANDLING_BRIEF.md). Interim posture: treat `Answer.note` as **sensitive free text**; it is **not covered** by "PII-free by construction." |
| S6 | Encryption in transit / at rest / key management | `PROPOSED` (documented per-engagement) | Hosting provider defaults + per-engagement configuration | No external attestation supplied; no formal key-management runbook attached |
| S7 | Tenant isolation, privileged-access management, MFA enforcement | `PROPOSED` (documented per-engagement) | Platform auth (see [`@nzila/platform-auth`](../../packages/platform-auth/)) | No external attestation; no penetration-test evidence supplied |
| S8 | Logging, SIEM retention, audit-log immutability | `PROPOSED` | — | No append-only audit-log attestation available |
| S9 | Vulnerability management, dependency & supply-chain security | `INTERNALLY_TESTED` (partial) | Snyk, npm audit, Trivy in CI | No SBOM published; no third-party penetration test |
| S10 | Backup, restoration, disaster recovery (RTO/RPO) | `PROPOSED` | — | No stated RTO/RPO; no restoration drill evidence |
| S11 | Incident response runbook & notification timelines | `PROPOSED` (per-engagement) | — | Referenced generically in the security brief; not attached |
| S12 | Data residency (e.g. Canadian region pinning) | `PROPOSED` (per-engagement) | Deployment-time configuration | No signed residency attestation for a live pilot |
| S13 | Deletion from backups, logs, exports, observability | `PROPOSED` | — | Documented at the answer/trace layer; not for backups, logs, or observability sinks |
| S14 | Bilingual (EN/FR) & WCAG accessibility conformance | `PROPOSED` for OCI/OCRA-specific surfaces | Platform-level bilingual/accessibility work is broader | No conformance report attached to the OCI/OCRA surfaces |

## 4. Legal, procurement, and commercial

| # | Property | Status | Evidence | Honest limit |
| --- | --- | --- | --- | --- |
| L1 | Liability, insurance, indemnification | `PROPOSED` | — | Not documented in the packet |
| L2 | IP ownership of responses, reports, derivative benchmarks | `PROPOSED` | — | Not documented in the packet |
| L3 | Buyer's right to audit methodology and source | `PROPOSED` | — | Not documented in the packet |
| L4 | Service levels, support, exit support | `PROPOSED` | — | Not documented in the packet |
| L5 | Subprocessor register, hosting provider disclosure | `PROPOSED` | — | Not documented in the packet |
| L6 | Appeal / correction / reconsideration mechanism for findings | `PROPOSED` | — | Not documented in the packet |
| L7 | Records-management posture (ATIP/FOI, litigation hold, discovery) | `PROPOSED` | — | Not documented in the packet |
| L8 | Conflict-of-interest controls (assessor–sales separation) | `PROPOSED` | — | Not documented in the packet |
| L9 | Indigenous data-sovereignty posture | `PROPOSED` | — | Not documented in the packet |

## 5. Pilot execution

| # | Property | Status | Evidence | Honest limit |
| --- | --- | --- | --- | --- |
| P1 | Priority pilot archetypes (Crown corp in leadership transition; municipality with COOP mandate) | `PROPOSED` | [`INTERNAL_PRE_MORTEM_HYPOTHETICAL_REVIEWER_CHALLENGES.md §4`](./INTERNAL_PRE_MORTEM_HYPOTHETICAL_REVIEWER_CHALLENGES.md) | These are **archetypes**, not identified candidates. A concrete candidate requires a sponsor role, jurisdiction, procurement route, data boundary, sample plan, assessor availability, success/failure criteria, decision date, and next action — **none of these are attached** for any prospective pilot. |
| P2 | One executed controlled pilot with preserved decision evidence | `PROPOSED` | — | No pilot has been executed. |

---

## Change control

| Date | Change | Author |
| --- | --- | --- |
| 2026-07-20 | Initial version. Introduces status taxonomy; consolidates and supersedes ad-hoc status claims across the government-readiness corpus. | Nzila platform team |

## Corrections known outstanding elsewhere in the corpus (to be reconciled to this matrix)

- Binder must retire the phrase *"every architectural gap is closed"* (G7–G9, S5–S13, L1–L9, P1–P2 remain open).
- Packet Part 1 must retire the *"PII-free by construction and verified by automated tests"* absolute (S1 covers only the scoring/finding/trace structures; S5 is an open free-text hole).
- Security brief §9 *"identical inputs yield byte-identical scores"* must be qualified by C3 (canonical payload, not full outputs).
- Security brief §2/§6 *"PII-free by construction"* must be scoped to the derived scoring and traceability schemas and must acknowledge S5.
- Procurement Readiness Assessment *"already procurement-grade"* language must be retired (L1–L9 remain open).
- Packet Part 2 worked example uses `vX`/`vY` and *"e.g."* — either flag as illustrative or replace with an exact reproducible fixture with commit SHA and hash.
