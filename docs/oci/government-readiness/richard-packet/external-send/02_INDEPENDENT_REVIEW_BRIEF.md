# Independent Review Brief — OCI/OCRA institutional-continuity assessment

> **Status.** Prepared for a single, senior, independent public-sector
> reviewer. Solicits **independent judgment**, not endorsement. Legal
> verification, formal security attestation, and commercial terms are out of
> scope for this pass. See
> [`../../IMPLEMENTATION_STATUS.md`](../../IMPLEMENTATION_STATUS.md) for the
> authoritative status of every claim in this brief.
>
> **Doctrine version:** 1.0.0 · **As of:** 2026-07-20

---

## 1. The problem, in one paragraph

Public-sector institutions — Crown corporations, ministries, regulators,
municipalities — are routinely asked to demonstrate that they will keep
functioning across leadership transitions, restructurings, workforce shocks,
and legal-regime changes. Existing tools measure **business continuity of
processes** (ISO 22301 BCMS) and **risk management** (ISO 31000). Neither
directly measures the **human and governance continuity fabric** those
frameworks *assume*: whether authority can be re-delegated in a hurry,
whether decisions can be reconstructed, whether obligations are named, and
whether the institution can defend its posture when challenged. OCI/OCRA is
an attempt to measure that fabric directly.

## 2. The category hypothesis

> **Institutional Continuity Readiness Assessment (OCRA).** The 0–100
> composite is not a risk score, not a maturity score, and not a compliance
> score. It is a **posture** score on five dimensions — governance
> resilience, transition readiness, operational continuity, external
> dependency exposure, decision-record integrity — assessed against a
> universal question bank with institutional context used *only* to change
> interpretation labels, never the number.
>
> The category is deliberately narrower than "governance" and broader than
> "succession planning." The claim we are testing with this brief is that
> **"institutional continuity"** — framed as the human/governance fabric
> that BCMS assumes but does not measure — is a credible, non-overclaiming
> label to a deputy minister, an Auditor General, and a Public Accounts
> Committee.

## 3. The architecture, in one diagram

```
 Evidence(ladder) → Finding → Obligation → Consequence
        └──── Confidence (evidence-fed, per finding) ────┘
                        → Recommendation (calm, finding-aware)
        ── reads, never writes ──▼
 SCORING CORE: 5 dimensions · weights · composite · maturity bands
```

Five properties define the shape:

1. **Deterministic canonical payload.** For identical substantive inputs,
   the *canonical* scoring payload (wall-clock timestamps excluded) is
   byte-identical and SHA-256-identical across runs. (The full scoring
   outputs are *not* byte-identical because they contain `scoredAt`
   timestamps — see the honest limit in
   [`../../IMPLEMENTATION_STATUS.md` §C3](../../IMPLEMENTATION_STATUS.md#1-core-scoring-determinism).)
2. **Additive, read-only Government-Readiness Layer.** Every property
   below sits *above* the scoring core and never mutates it or changes any
   score. Proven by a deep-clone non-regression test.
3. **Seven-answer finding contract.** A finding is not surfaced unless it
   carries evidence, a statement, an obligation mapping, a dimension
   contribution, an evidence-fed confidence envelope, a consequence, and
   at least one recommendation reference.
4. **Evidence-fed, ordinal confidence.** No probabilities. The confidence
   envelope composes the *lowest* contributing band; a `VERBAL` evidence
   level can never yield `HIGH` or `MODERATE` confidence; `NONE` yields
   `INSUFFICIENT`.
5. **Chain-integrity gate.** A report may render findings only when the
   traceability record's `intact` flag is true.

## 4. One worked finding, end-to-end (illustrative, not byte-reproducible)

> **Illustrative example.** Numeric values, version stamps, and "e.g."
> contributions are chosen for legibility. For an exact, byte-reproducible
> fixture with commit SHA, canonical-payload hash, and pinned scoring/
> question-bank versions, see
> [`../../EVIDENCE_MANIFEST.md`](../../EVIDENCE_MANIFEST.md).

**Finding.** *"Succession authority for the executive director is
undocumented."* (`f.succession_authority_undocumented`)

| # | Field | Value |
| --- | --- | --- |
| 1 | Evidence | `VERBAL` (interview only, no delegation instrument produced), single source, no corroboration |
| 2 | Finding | `f.succession_authority_undocumented`, severity `serious`, derived deterministically from `Q-GOV-03` + `Q-OPS-07` traces |
| 3 | Obligation | **Governance** (tier 4), **Fiduciary** (tier 3), **Continuity** (tier 6) asserted. **Statutory NOT asserted** — evidence is below the `DOCUMENTED` floor required to name a statutory breach. Lead framing: Fiduciary (highest tier). |
| 3B | Source instrument | Governance → `si.governance_bylaws` *referenced, not asserted* (evidence below floor; instrument itself `UNVERIFIED`). Statutory → `si.enabling_statute` *withheld, referenced only.* No clause number is emitted — `clauseRef` is `null` until a policy owner or qualified counsel confirms it. |
| 4 | Dimension | Contributes to `transition_readiness` (continuity-positive); reduces the continuity-positive `governance_resilience` dimension. Weighted contribution read from `questionTraces[].dimensionContributions`; the traceability layer reads, never computes. |
| 5 | Confidence | Ordinal band `LOW` (evidence-band cap: `VERBAL → LOW`). Rationale attached: `["evidence: VERBAL (band LOW)", "single source — no corroboration", "final confidence: LOW"]`. No probability. |
| 6 | Consequence | Institutional + Service Delivery, gated by confidence: *"An unplanned departure could strand signing authority for the program. This is a standing exposure; it has not been independently evidenced."* |
| 7 | Recommendation | `rec.governance_workshop` + document delegation of authority. Traces back to this finding (no orphan). |

**Chain-integrity attestation (institution-level).**
> ✅ Every surfaced finding is evidence-linked, obligation-mapped,
> confidence-bounded, and recommendation-complete. Scoring and obligation
> taxonomy versions are pinned per assessment; the exact stamps for this
> illustrative example are in
> [`../../EVIDENCE_MANIFEST.md`](../../EVIDENCE_MANIFEST.md).

## 5. What is implemented (and internally tested)

The following are **`INTERNALLY_TESTED`** — automated tests exist and are run
in CI against the implementation. `INTERNALLY_TESTED` is **not** validation.

- Deterministic 5-dimension scoring engine + maturity band resolver.
- Deterministic canonical scoring payload with SHA-256 hash
  ([test](../../../../../apps/union-eyes/lib/icra/__tests__/government-readiness/canonical-scoring-payload.test.ts)).
- Fairness invariant: context changes labels, never numbers.
- Additive non-regression: the government-readiness layer never mutates the
  scoring trace and never changes any score.
- Seven-answer finding-completeness contract with PII-marker regression.
- Obligation taxonomy (7 classes) with isolation tests (obligations module
  cannot import the scoring engine).
- Confidence envelope with evidence-floor discipline (`@nzila/oci-confidence`).
- Traceability record with version pinning (scoring / question bank /
  obligation / consequence / source catalogue), including the *no orphan
  recommendation* check at the record layer.
- k-anonymity K = 5 publication guard on aggregation.
- Enum-only, PII-key-rejecting operational telemetry.

## 6. What is not yet verified (honest gaps)

The following are **`PROPOSED`** or `IMPLEMENTED` but **not** validated,
measured, attested, or piloted:

1. **No empirically-measured inter-rater reliability.** The harness is
   built; no κ, ICC, or band-agreement value has been observed against a
   real reviewer panel.
2. **No verified source-instrument catalogue.** The seed catalogue is
   entirely `UNVERIFIED`; no citation is defensible until real instruments,
   jurisdictions, dates, clauses, and applicability logic are populated and
   confirmed by qualified counsel.
3. **No certified assessor corps.** Zero certified assessors exist. The
   assessor standard is policy-only.
4. **No external security-control evidence.** Encryption, key management,
   tenant isolation, MFA enforcement, SIEM retention, backup/restoration,
   incident response, and data residency are `PROPOSED` per-engagement, not
   independently attested.
5. **Free-text `Answer.note` is not PII-safe.** The derived scoring/
   finding/traceability artifacts exclude direct personal identifiers by
   schema, but the source `Answer` model still carries an optional free-
   text `note` field that can contain personal or confidential content.
   Pilot engagements must disable, ephemeralize, or externally secure this
   field.
6. **No executed pilot.** Two priority archetypes are named — a Crown
   corporation in leadership transition and a municipality with a
   Committee-of-the-Whole (COOP) mandate — but no concrete pilot has been
   scoped or run.
7. **No commercial/legal packet.** Liability, insurance, IP ownership,
   audit rights, service levels, exit support, subprocessor register,
   appeal mechanism, records-management posture (ATIP/FOI, litigation
   hold, discovery), conflict-of-interest controls, and Indigenous data-
   sovereignty posture are all `PROPOSED`.
8. **No external validation of the architecture.** This brief is
   self-attested against the codebase. That is why we are writing to you.

The internal document historically titled *"Government Validation Report V1"*
has been renamed
[`INTERNAL_PRE_MORTEM_HYPOTHETICAL_REVIEWER_CHALLENGES.md`](../../INTERNAL_PRE_MORTEM_HYPOTHETICAL_REVIEWER_CHALLENGES.md)
to make explicit that it is a Nzila red-team exercise — an internal
challenge document imagining what a reviewer might say — not an external
validation. It is not attached to this send and should not be treated as
review evidence.

## 7. What we are and are not claiming

**We claim.** OCI/OCRA is a deterministic, explainable,
non-regressive institutional-continuity assessment architecture with a
defensible read-only obligation/consequence/confidence layer, internally
tested, in a state where an independent public-sector reviewer can form a
first judgment about whether the *shape* is credible for public-sector use.

**We do not claim.** Government-grade. Procurement-grade. Empirically
calibrated. Externally validated. Defensible in a real public-sector
decision. Free of privacy risk in the complete data flow. Ready to enter a
regulator engagement. Any assertion of a specific legal instrument.

## 8. The five decisions we are asking you to help with

See [`03_REVIEWER_RESPONSE_FORM.md`](./03_REVIEWER_RESPONSE_FORM.md). In
summary:

1. Is the *category* language credible to a deputy minister, an Auditor
   General, and a Public Accounts Committee?
2. Is the *evidence → confidence → obligation* coupling defensible and
   usable to a public-sector buyer?
3. Is the *obligation hierarchy* posture ("name the tension, don't net it")
   defensible, and is the seven-class taxonomy the right shape?
4. Of the honest open items, what is the *single item* most likely to block
   a Crown corporation or municipal pilot, and what evidence would unblock
   it?
5. Which items can you assess directly, which require the sponsoring
   institution's policy owner, and which require qualified counsel, a
   security auditor, a procurement authority, or a methodology specialist?

## 9. Boundary of this ask

There is **no** expectation of endorsement. There is **no** implicit
commitment to further engagement. If your independent judgment is that the
architecture is not ready for public-sector use, or that it is ready for a
narrower use than we imagine, that answer is more valuable than a soft
"yes." If the answer is that the ask itself is malformed, that too is what
we need to hear.

Deeper materials are indexed in
[`04_EVIDENCE_INDEX.md`](./04_EVIDENCE_INDEX.md) and available on request;
they are deliberately not attached.
