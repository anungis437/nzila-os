# OCI / OCRA Security & Data-Handling Brief

> **Status:** Procurement-facing brief — describes the as-built security and
> data-handling posture of the OCI/OCRA assessment and its additive
> Government-Readiness Layer. **Read alongside** the authoritative
> [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md); where any claim below
> drifts from that matrix, the matrix wins.
> **Audience:** Municipal evaluators, public-sector pilot sponsors, Crown
> corporation risk officers, government advisory buyers, and independent
> external reviewers.
> **Companion to:** [Procurement Readiness Assessment](OCI_OCRA_PROCUREMENT_READINESS_ASSESSMENT.md),
> [Richard Validation Packet](richard-packet/RICHARD_VALIDATION_PACKET.md).
> **Doctrine version:** 1.0.0 · **As of:** 2026-07-20
>
> **Scope caveat.** This brief documents the *data-handling* and *derived-
> artifact privacy* posture. It is **not** a complete public-sector security
> assurance package. It does not yet establish encryption/key-management
> attestations, tenant-isolation attestations, MFA enforcement evidence, SIEM
> retention terms, vulnerability-management SLAs, penetration-test results,
> backup/restoration drills, disaster-recovery RTO/RPO, incident-notification
> timelines, subprocessor register, hosting-provider disclosure, security
> certifications, or a bilingual/accessibility conformance report. See
> [IMPLEMENTATION_STATUS.md §3](IMPLEMENTATION_STATUS.md#3-security-privacy-and-data-handling)
> for the honest status of each of those items.

---

## 0. One-paragraph summary (for evaluators in a hurry)

OCI/OCRA is a **deterministic, explainable institutional-continuity assessment**.
It scores an institution's *posture*, never its people. The scoring core is
deterministic; the new Government-Readiness Layer is **read-only** over that
core and adds traceability, evidence-bounded confidence, and a chain-integrity
gate. The **derived** persisted artifacts — scoring traces, findings, and
traceability records — are **designed to exclude direct personal identifiers by
schema**, and this is enforced by automated regression tests over their
surfaced content. The complete assessment data flow (including the source
`Answer` model, which still carries an optional free-text `note` field) remains
subject to a full data inventory and privacy validation — see §2 below. AI is
never in the scoring path. The sections below state exactly what is and is not
collected, where it lives, how long it is kept, who can reach it, how it is
anonymized, how an institution can withdraw/export/delete its data, and what
this brief does **not** yet establish.

---

## 1. Data collected

The assessment is question-driven. The data that enters the system is bounded and
low-cardinality:

| Category | Examples | Form |
| --- | --- | --- |
| **Assessment responses** | Ordinal answers to continuity questions (0–4 scale) | Enumerated values, not free prose |
| **Assessment identifier** | A pseudonymous handle for one assessment run | Opaque id; not a person |
| **Institutional context selectors** | Sector archetype, size band, structure band | Low-cardinality enum tokens |
| **Reviewer-supplied evidence level** | One of six ladder levels per finding theme (`NONE`…`CROSS_VALIDATED`) | Enum token |
| **Derived artifacts** | Dimension scores, composite, maturity band, findings, obligations, consequences, confidence bands | Computed; deterministic |
| **Operational telemetry (optional)** | Enum-only event tokens (e.g., section advanced) | No PII; allow-listed keys only |

**Key property:** answers are *ordinal selections*, and context is *band
selection*. The system is designed so that the institutional **posture** can be
reconstructed from these tokens without ever needing a name, an email, or a free
-text narrative.

---

## 2. Data NOT collected (in the derived scoring/finding/traceability artifacts)

By schema, the **derived** artifacts (scoring trace, findings, traceability
record) do **not** contain:

- **No personal identifiers** in the derived structures — no names, emails,
  phone numbers, employee ids, or role-holder identities in scoring traces,
  findings, or traceability records (asserted for surfaced finding statements
  by the PII-marker regression test).
- **No free-text narrative in the finding catalogue.** Finding statements are
  drawn from a fixed, PII-free catalogue (e.g., *"Succession authority is not
  documented as a governance instrument."*), never composed from individual
  data.
- **No surveillance of individuals.** OCI/OCRA assesses the *institution's*
  posture; it never profiles, ranks, or scores a person.
- **No covert telemetry.** Operational telemetry is enum-only and passes an
  allow-list; PII-shaped keys (email, orgName, etc.) are rejected.
- **No raw answers in benchmarks.** Published aggregates never include a
  single institution's responses.

### 2.1 Known free-text hole: `Answer.note` on the source model

> **Honest correction.** The `Answer` model at the *source* of the assessment
> (before scoring) currently accepts an optional free-text `note?: string`
> field via `buildAnswer(question, rawValue, note)`. That field is trimmed and
> persisted on the answer. It is **not** part of the derived scoring trace or
> finding catalogue, but if answers are persisted or exported it *can* travel
> with them, and a reviewer *could* place personal, confidential, or
> otherwise-sensitive content there.
>
> Therefore the claim *"no free-text narrative enters the scored or persisted
> path"* is **incorrect while `Answer.note` exists as a free-text field.**
>
> Interim posture (as of 2026-07-20):
>
> - `Answer.note` is classified as **sensitive free text** and is **not
>   covered** by *"PII-free by construction."*
> - Pilot engagements must either (a) disable capture of `Answer.note`
>   entirely, (b) treat it as ephemeral and refuse to persist it, or (c)
>   route it into a separately-secured evidence repository outside the
>   PII-free derived-artifact estate.
> - A follow-on change will either remove `note` from the assessment model,
>   restrict it to an enumerated code, or ephemeralize it. Tracked in
>   [IMPLEMENTATION_STATUS.md §S5](IMPLEMENTATION_STATUS.md#3-security-privacy-and-data-handling).

### 2.2 What the PII regression test does — and does not — prove

The finding-completeness test scans surfaced finding statements for a small
regex vocabulary (`@`, `Mr.`, `Mrs.`, `email`). This is a **smoke test**, not
a PII guarantee. It does **not** detect:

- names, phone numbers, employee ids, addresses, union positions;
- French honorifics, Indigenous identifiers, unusual job titles;
- small-cell identifiers or protected operational details.

The defensible property today is: **the finding catalogue is a fixed,
reviewer-authored set of institutional statements with a passing PII-marker
regression test.** A full field-level privacy assessment and a data-inventory
review are still required before this can be presented as a comprehensive
privacy guarantee.

**Enforcement, not promise (for what it does cover).** The following tests are
run in CI:

- A privacy regression suite that forbids PII-shaped telemetry keys
  (`adaptiveTelemetryPrivacyRegression.test.ts`).
- A routing-explainability snapshot test asserting enum-only, no-PII output
  (`routingExplainabilitySnapshot.test.ts`).
- The Government-Readiness finding-completeness test, which asserts surfaced
  finding statements contain no PII markers (from the regex vocabulary above)
  (`__tests__/government-readiness/finding-completeness.test.ts`).

---

## 3. Data residency

- **Authentication-mode dependent.** OCI/OCRA runs within the Nzila platform,
  whose hosting region is a deployment-time configuration. For a public-sector
  pilot, residency (e.g., Canadian region) is pinned as a **pilot precondition**
  in the engagement agreement, not left to default.
- **Artifacts are portable JSON.** Scoring traces, findings, and traceability
  records are plain, serializable JSON with no external references or embedded
  binaries — they can be hosted in the buyer's tenancy or region without
  transformation.
- **No third-party scoring calls.** Scores are computed in-process. The scoring
  path makes **no outbound network calls** and depends on **no external AI
  service**, so assessment data does not transit a third party to be scored.

> Residency commitment for a given pilot is documented per engagement and is a
> gating item in the [pilot exit/entry criteria](#7-withdrawal-export-and-deletion).

---

## 4. Data retention

- **Deterministic re-derivability.** Because scoring is deterministic and
  version-pinned, derived artifacts can be **regenerated from the source answers**
  at any time. This means retention can be minimized: the buyer may retain only
  what they need (e.g., the answer set, or only the final traceability record).
- **Version pinning for audit.** Every traceability record carries
  `scoringVersion`, `obligationTaxonomyVersion`, and `consequenceModelVersion`,
  so a retained record remains interpretable and reproducible against the exact
  logic that produced it.
- **Retention is a policy parameter, not a hard-coded floor.** Default retention
  windows are set per engagement; there is no technical requirement to retain raw
  responses once the institution's report is delivered.
- **Recommended posture for pilots:** retain the **traceability record** (no PII)
  for audit; retain raw answers only for the active assessment window, then purge.

---

## 5. Access controls

- **Platform authentication and authorization.** Access to assessments and
  results is mediated by the platform's auth layer (session/identity, scoped
  access). Results are not public by default.
- **Least-privilege artifacts.** Because traceability records carry no PII, the
  audit/oversight role can be granted **review access to the chain** without ever
  exposing personal data — separation of "who can see the methodology" from "who
  can see the institution."
- **No standing AI access to data.** No AI component holds credentials to read or
  write scores; the AI boundary (Section 8) is structural.
- **Administrative actions are auditable.** Export and deletion are explicit,
  logged operations rather than ambient capabilities.

---

## 6. Anonymization

- **Derived scoring/finding/traceability artifacts are designed to exclude
  direct personal identifiers by schema.** The complete assessment data flow
  — including the source `Answer.note` free-text field — remains subject to
  a data-inventory and privacy validation (see §2.1).
- **Pseudonymous assessment ids.** The assessment handle is opaque and is
  anonymized further upstream before any cross-assessment aggregation.
- **k-anonymity K = 5 for any published aggregate.** No benchmark or cohort
  statistic is published unless **≥ 5 institutions** are in the cohort — a
  re-identification floor inherited from the OCI intelligence-ethics doctrine
  and codified in the
  [benchmark governance review](OCI_OCRA_BENCHMARK_GOVERNANCE_REVIEW.md).
- **No rankings, refusal-first.** The observatory posture is opt-in, publishes
  no institutional leaderboards, and refuses to emit a statistic it cannot
  publish safely.

---

## 7. Withdrawal, export, and deletion

- **Withdrawal.** Participation is opt-in. An institution may withdraw from
  benchmark/observatory aggregation; because aggregates honor the K = 5 floor and
  exclude withdrawn institutions, withdrawal removes the institution's
  contribution from future published statistics.
- **Export.** All artifacts are portable JSON (answers, scoring trace, findings,
  traceability record). Export is a serialization of data the buyer already owns —
  no proprietary lock-in format, no required re-platforming. The traceability
  record is independently verifiable: `JSON.parse(JSON.stringify(record))`
  round-trips with no functions or cycles (asserted by the no-orphan test).
- **Deletion.** Because the system can re-derive everything from source answers,
  deletion is unambiguous: remove the answer set and the derived artifacts, and
  nothing personal remains because nothing personal was stored. Deletion is an
  explicit, logged operation.
- **Pilot exit.** A pilot can be exited cleanly: export the records, delete the
  source data, and the institution retains a portable, version-pinned audit trail
  with no residual dependency on the platform.

---

## 8. AI boundary

OCI/OCRA's AI posture is **structural**, not promissory:

- **AI never scores.** The scoring core is deterministic. AI never computes a
  dimension, composite, or maturity band, and never determines a finding's
  evidence level or confidence.
- **AI never decides, routes, or profiles.** The five-layer AI architecture keeps
  AI out of the scoring, routing, and profiling paths entirely.
- **The Government-Readiness Layer adds no AI.** Findings, obligations,
  consequences, confidence, and the traceability record are produced by **pure,
  deterministic functions** over the frozen scoring trace. The obligation and
  consequence modules do not even import the scoring engine (enforced by an
  import-graph isolation test), and they certainly invoke no model.
- **Confidence is categorical, never probabilistic.** The system emits ordinal
  confidence bands (`HIGH`/`MODERATE`/`LOW`/`INSUFFICIENT`) with plain-language
  rationale. It emits **no percentages and no probabilities** — asserted by the
  confidence-floor test, which scans rationale output for any `%` or
  probability language.

> See [Architecture Decision §AI boundary](GOVERNMENT_READINESS_ARCHITECTURE_DECISION.md)
> and the [Explainability Model](OCI_OCRA_EXPLAINABILITY_MODEL.md).

---

## 9. Integrity & defensibility guarantees

These properties make the output **defensible** to an auditor or regulator:

- **Determinism (canonical payload).** Identical substantive inputs yield a
  byte-identical *canonical scoring payload* (defined in
  [`canonicalScoringPayload.ts`](../../../../apps/union-eyes/lib/icra/traceability/canonicalScoringPayload.ts))
  and an identical SHA-256 reproducibility hash. Wall-clock metadata
  (`scoredAt`, `generatedAt`, `answeredAt`) is deliberately excluded from the
  canonical payload so it cannot mask substantive drift and so the hash is
  stable across runs. The *full* scoring outputs are **not** byte-identical
  because they contain those timestamps. See
  [IMPLEMENTATION_STATUS.md §C3](IMPLEMENTATION_STATUS.md#1-core-scoring-determinism).
- **Non-regression.** The additive layer **never mutates** the scoring trace
  and **never changes** any score; proven by deep-clone comparison in the
  backward-compatibility test.
- **Seven-answer completeness.** No finding is surfaced unless it carries
  evidence, a statement, an obligation mapping, a dimension contribution, a
  confidence envelope, a consequence, and at least one recommendation. Partial
  findings are **suppressed, never shown**.
- **Evidence floor on confidence.** A finding's confidence can never exceed
  what its evidence supports (`VERBAL` is never `HIGH`/`MODERATE`; `NONE` is
  `INSUFFICIENT`) — no amount of corroboration or sample size can lift it.
- **Chain integrity gate.** A report may render findings only when the
  traceability record's `intact` flag is true: every finding is
  evidence-linked, confidence-bounded, obligation-mapped, and carries at
  least one recommendation reference. The stronger *no-orphan-recommendation*
  invariant — that every rendered recommendation resolves to a finding — is
  computed at the record layer when the caller supplies the surfaced
  recommendation set (see
  [IMPLEMENTATION_STATUS.md §G6](IMPLEMENTATION_STATUS.md#2-additive-government-readiness-layer)).

All five guarantees are covered by the non-regression suite (26 tests) and run
green alongside the full ICRA suite (479 tests). See the
[Non-Regression Test Specification](implementation/NON_REGRESSION_TEST_SPECIFICATION.md).

---

## 10. Incident handling

- **Containment posture (derived-artifact scope only).** The scoring path is
  offline (no third-party scoring calls) and the *derived* persisted artifacts
  are designed to exclude direct personal identifiers, so the personal-data
  blast radius of a data incident affecting the scoring/finding/traceability
  estate is structurally limited. This is **not** a broad statement that an
  OCI/OCRA assessment carries no sensitive content: an assessment can contain
  highly sensitive **institutional** information even without PII — governance
  weaknesses, delegation gaps, continuity vulnerabilities, legal-compliance
  concerns, labour-relations strategy, cabinet or board confidences,
  solicitor-client privileged material, and commercially sensitive operational
  dependencies. That information warrants protection even when no individual is
  identified.
- **Detection.** Privacy regression tests act as a **build-time tripwire**: a
  change that would route PII into telemetry, findings, or snapshots fails the
  test suite before it can ship.
- **Response, per pilot.** For a public-sector pilot, incident response roles,
  notification timelines, and contact paths must be agreed in the engagement
  and inherit the platform's security operations process. This brief documents
  the *data-handling* properties that bound an incident; the *operational*
  runbook is attached per engagement and is not yet independently attested
  (see [IMPLEMENTATION_STATUS.md §S11](IMPLEMENTATION_STATUS.md#3-security-privacy-and-data-handling)).
- **Reproducibility aids forensics.** Version-pinned, deterministic canonical
  payloads let an investigator reconstruct exactly what was computed, from
  which inputs, under which logic version.

---

## 11. What this brief does NOT yet claim (honest gaps)

Consistent with the [Procurement Readiness Assessment](OCI_OCRA_PROCUREMENT_READINESS_ASSESSMENT.md)
and the authoritative [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md),
the following remain open and are **not** asserted here:

- **Inter-rater reliability (IRR) is unmeasured.** The confidence model
  consumes a reviewer-variance signal, but no IRR coefficient from paired
  raters has been collected yet (G9). This is the primary gate for the
  **Regulator** archetype.
- **External validation is pending.** This brief is self-attested against the
  codebase. The document historically titled *"Government Validation Report
  V1"* has been renamed
  [INTERNAL_PRE_MORTEM_HYPOTHETICAL_REVIEWER_CHALLENGES.md](INTERNAL_PRE_MORTEM_HYPOTHETICAL_REVIEWER_CHALLENGES.md)
  to clarify that it is an internal red-team pre-mortem, not external
  validation.
- **Benchmark publication enforcement.** The cohort-minimum guard is
  `INTERNALLY_TESTED` in code (G10, S3); no benchmark has been published
  against a real cohort yet.
- **Coefficient calibration** remains practitioner-informed pending a
  calibration roadmap.
- **Security-assurance items not yet established.** Encryption in transit and
  at rest, key management, secret management, tenant isolation, privileged-
  access management, MFA enforcement, logging and SIEM retention,
  vulnerability management, secure development lifecycle, penetration testing,
  dependency/supply-chain security attestations, backup and restoration
  drills, disaster recovery (RTO/RPO), incident severity and notification
  timelines, subprocessor register, hosting-provider disclosure, actual
  Canadian residency attestation, breach history, deletion from backups/logs/
  exports/observability tools, audit-log immutability, and formal security
  certifications or control mappings — all `PROPOSED` per-engagement, not
  independently attested. See
  [IMPLEMENTATION_STATUS.md §3 (S6–S14)](IMPLEMENTATION_STATUS.md#3-security-privacy-and-data-handling).
- **Legal, procurement, and commercial packet.** Liability, insurance and
  indemnification; IP ownership; buyer's right to audit; service levels and
  support; exit support; subprocessor register; appeal/correction/
  reconsideration mechanism; records-management (ATIP/FOI, litigation hold,
  discovery); conflict-of-interest controls; Indigenous data-sovereignty
  posture — all `PROPOSED`. See
  [IMPLEMENTATION_STATUS.md §4](IMPLEMENTATION_STATUS.md#4-legal-procurement-and-commercial).
- **Bilingual (EN/FR) & WCAG accessibility conformance** on the OCI/OCRA
  surfaces is `PROPOSED`; no conformance report is attached (S14).

---

## 12. Readiness mapping (which archetypes this unlocks)

| Archetype | This brief's effect |
| --- | --- |
| **D — Municipal** | Closes the "clarity + privacy + plain data handling" requirement → **ready pending pilot residency pinning** |
| **E — Public-Sector Pilot** | Provides the security/data brief named as the critical gap → **ready to scope a pilot** |
| **A — Government Advisory** | Reinforces traceability + neutrality with documented data posture → **strengthens an already-ready position** |
| **B — Crown Corporation** | Supports methodology-rigor conversation; benchmark publication rules still pending |
| **C — Regulator** | Necessary but not sufficient; still gated on **IRR + external validation** |

---

## 13. For an external validation session

This brief lets the packet say, credibly:

> *The core is deterministic (canonical payload, hash-stable) and
> non-regressive. The new layer is traceable and evidence-bounded. Here is
> exactly how derived data is handled, what the derived artifacts do and do
> not contain, and where the remaining validation gates (IRR, external
> sign-off, security-assurance attestations, legal/commercial packet, real
> pilot execution) are.*

Cross-reference: [Richard Validation Packet](richard-packet/RICHARD_VALIDATION_PACKET.md)
· [Validation Workbook](richard-packet/VALIDATION_WORKBOOK.md)
· [Implementation Status Matrix](IMPLEMENTATION_STATUS.md).
