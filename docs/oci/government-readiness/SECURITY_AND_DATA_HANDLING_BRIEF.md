# OCI / OCRA Security & Data-Handling Brief

> **Status:** Procurement-facing brief — describes the as-built security and
> data-handling posture of the OCI/OCRA assessment and its additive
> Government-Readiness Layer.
> **Audience:** Municipal evaluators, public-sector pilot sponsors, Crown
> corporation risk officers, government advisory buyers, and the external
> validator (Richard Sharpe).
> **Companion to:** [Procurement Readiness Assessment](./OCI_OCRA_PROCUREMENT_READINESS_ASSESSMENT.md),
> [Richard Validation Packet](./richard-packet/RICHARD_VALIDATION_PACKET.md).
> **Doctrine version:** 1.0.0 · **As of:** 2026-06-14

---

## 0. One-paragraph summary (for evaluators in a hurry)

OCI/OCRA is a **deterministic, explainable institutional-continuity assessment**.
It scores an institution's *posture*, never its people. The scoring core is frozen
and reproducible; the new Government-Readiness Layer is **read-only** over that
core and adds traceability, evidence-bounded confidence, and a chain-integrity
gate. Persisted artifacts — scoring traces, findings, and traceability records —
**contain no personal information by construction**, a property enforced by
automated regression tests, not by policy alone. AI is never in the scoring path.
The sections below state exactly what is and is not collected, where it lives,
how long it is kept, who can reach it, how it is anonymized, and how an
institution can withdraw, export, or delete its data.

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

## 2. Data NOT collected

By construction, the assessment and its persisted artifacts do **not** contain:

- **No personal identifiers** — no names, emails, phone numbers, employee ids,
  or role-holder identities in scoring traces, findings, or traceability records.
- **No free-text narrative** in the scored/persisted path. Finding statements are
  drawn from a fixed, PII-free catalogue (e.g., *"Succession authority is not
  documented as a governance instrument."*), never composed from individual data.
- **No surveillance of individuals.** OCI/OCRA assesses the *institution's*
  posture; it never profiles, ranks, or scores a person.
- **No covert telemetry.** Operational telemetry is enum-only and passes an
  allow-list; PII-shaped keys (email, orgName, etc.) are rejected.
- **No raw answers in benchmarks.** Published aggregates never include a single
  institution's responses.

**Enforcement, not promise.** These are guarded by automated tests, including:

- A privacy regression suite that forbids PII-shaped telemetry keys
  (`adaptiveTelemetryPrivacyRegression.test.ts`).
- A routing-explainability snapshot test asserting enum-only, no-PII output
  (`routingExplainabilitySnapshot.test.ts`).
- The Government-Readiness finding-completeness test, which asserts surfaced
  finding statements contain **no PII markers**
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

- **PII-free by construction** (Section 2), verified by tests.
- **Pseudonymous assessment ids.** The assessment handle is opaque and is
  anonymized further upstream before any cross-assessment aggregation.
- **k-anonymity K = 5 for any published aggregate.** No benchmark or cohort
  statistic is published unless **≥ 5 institutions** are in the cohort — a
  re-identification floor inherited from the OCI intelligence-ethics doctrine and
  codified in the [benchmark governance review](./OCI_OCRA_BENCHMARK_GOVERNANCE_REVIEW.md).
- **No rankings, refusal-first.** The observatory posture is opt-in, publishes no
  institutional leaderboards, and refuses to emit a statistic it cannot publish
  safely.

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

> See [Architecture Decision §AI boundary](./GOVERNMENT_READINESS_ARCHITECTURE_DECISION.md)
> and the [Explainability Model](./OCI_OCRA_EXPLAINABILITY_MODEL.md).

---

## 9. Integrity & defensibility guarantees

These properties make the output **defensible** to an auditor or regulator:

- **Determinism.** Identical inputs yield byte-identical scores; proven by the
  backward-compatibility test across multiple postures.
- **Non-regression.** The additive layer **never mutates** the scoring trace and
  **never changes** any score; proven by deep-clone comparison in the
  backward-compatibility test.
- **Seven-answer completeness.** No finding is surfaced unless it carries
  evidence, a statement, an obligation mapping, a dimension contribution, a
  confidence envelope, a consequence, and at least one recommendation. Partial
  findings are **suppressed, never shown**.
- **Evidence floor on confidence.** A finding's confidence can never exceed what
  its evidence supports (`VERBAL` is never `HIGH`/`MODERATE`; `NONE` is
  `INSUFFICIENT`) — no amount of corroboration or sample size can lift it.
- **Chain integrity gate.** A report may render findings only when the
  traceability record's `intact` flag is true: every finding is evidence-linked,
  confidence-bounded, obligation-mapped, and every recommendation resolves to a
  finding (**no orphan recommendations**).

All five guarantees are covered by the non-regression suite (26 tests) and run
green alongside the full ICRA suite (479 tests). See the
[Non-Regression Test Specification](./implementation/NON_REGRESSION_TEST_SPECIFICATION.md).

---

## 10. Incident handling

- **Containment posture.** Because the scoring path is offline (no third-party
  scoring calls) and persisted artifacts are PII-free, the blast radius of a data
  incident is structurally limited: there is no personal data in the scoring/
  finding/traceability artifacts to exfiltrate.
- **Detection.** Privacy regression tests act as a **build-time tripwire**: a
  change that would route PII into telemetry, findings, or snapshots fails the
  test suite before it can ship.
- **Response, per pilot.** For a public-sector pilot, incident response roles,
  notification timelines, and contact paths are agreed in the engagement and
  inherit the platform's security operations process. This brief documents the
  *data-handling* properties that bound an incident; the *operational* runbook is
  attached per engagement.
- **Reproducibility aids forensics.** Version-pinned, deterministic artifacts let
  an investigator reconstruct exactly what was computed, from which inputs, under
  which logic version.

---

## 11. What this brief does NOT yet claim (honest gaps)

Consistent with the [Procurement Readiness Assessment](./OCI_OCRA_PROCUREMENT_READINESS_ASSESSMENT.md),
the following remain open and are **not** asserted here:

- **Inter-rater reliability (IRR) is unmeasured.** The confidence model consumes a
  reviewer-variance signal, but no IRR coefficient from paired raters has been
  collected yet. This is the primary gate for the **Regulator** archetype.
- **External validation is pending.** This brief is self-attested against the
  codebase; independent sign-off (Richard Sharpe) is the next gate.
- **Benchmark publication enforcement** (cohort-minimum guard in code) is
  specified but not yet enforced programmatically; it is required before any
  public benchmark report, not before a first validation conversation.
- **Coefficient calibration** remains practitioner-informed pending a calibration
  roadmap.

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

## 13. For the validation session (Richard)

This brief lets the Richard packet say, credibly:

> *The core is deterministic and non-regressive. The new layer is traceable and
> evidence-bounded. Here is exactly how data is handled, what is not collected,
> and where the remaining validation gates (IRR, external sign-off) are.*

Cross-reference: [Richard Validation Packet](./richard-packet/RICHARD_VALIDATION_PACKET.md)
· [Validation Workbook](./richard-packet/VALIDATION_WORKBOOK.md).
