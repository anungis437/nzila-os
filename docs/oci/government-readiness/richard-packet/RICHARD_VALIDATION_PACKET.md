# Richard Sharpe Validation Packet

> **Status:** Validation packet — for senior public-sector review.
> **Purpose:** Everything Richard Sharpe needs in one place to validate the
> OCI/OCRA government-readiness architecture: a one-page summary, one finding
> rendered end-to-end, the five decisions only he can make, and a pointer to the
> structured workbook.
> **Protocol:** [RICHARD_SHARPE_VALIDATION_PROTOCOL.md](../RICHARD_SHARPE_VALIDATION_PROTOCOL.md)
> · **Workbook:** [VALIDATION_WORKBOOK.md](./VALIDATION_WORKBOOK.md)
>
> **Not to be confused with the CIVIC front-door outreach.** This packet is *inbound*
> validation of OCI/OCRA architecture by a senior public-sector reviewer. The *outbound*
> public-service forwardable introduction (CIVIC front door) is a separate track — see
> [`docs/public-service/forwardable/richard-first-send-package.md`](../../../public-service/forwardable/richard-first-send-package.md).
> The two tracks share only the reviewer's first name; they must not be conflated in
> preparation, sequencing, or attachments. See
> [CIVIC ↔ OCI Alignment §6](../../../CIVIC_OCI_ALIGNMENT.md#6-the-two-richard-tracks-resolved).

---

## Part 1 — One-page architecture summary

### The claim

> OCI/OCRA is being made **defensible for public-sector scrutiny without changing
> how it scores**. A read-only **traceability / obligation / consequence /
> confidence / explainability** layer sits above a **frozen, universal scoring
> core** and is entering structured external review.
>
> The label *"government-grade"* is not asserted; see the honest limits and open
> external-validation gate in
> [IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md).

### What is frozen (must not change)

- Five dimensions, weights, composite (= `institutional_continuity`), and the five
  maturity bands.
- Fairness: institutional context changes **interpretation labels only**, never the
  number.
- Comparability: one universal 0–100 scale; core questions always included.
- Anti-surveillance posture; five-layer AI boundary (AI never scores, decides,
  routes, or profiles).
- Observatory: opt-in, k-anonymity K=5, characteristic (non-normative) baselines,
  no rankings.

### What is added (read-only over the core, non-scoring)

| Layer | One-line purpose |
| --- | --- |
| **Finding** | The addressable unit of explanation derived from answers + evidence |
| **Obligation** | Names the duty a finding implicates (7 classes), reporting context only |
| **Confidence** | Honest, ordinal, evidence-fed certainty per finding (no probabilities) |
| **Consequence** | What the finding could cost the institution (6 classes) |
| **Explainability** | The seven-answer reconstruction contract for every finding |

### Why this is the right architecture

- A government **scoring overlay** would fork benchmarks, multiply calibration
  surfaces, and reverse the "context → interpretation, not score" discipline.
  Rejected.
- The additive layer preserves fairness, determinism, and benchmark integrity **by
  construction** — the number never moves — while giving auditors what they
  actually ask for: *reconstruct why this finding holds.*

### The one diagram

```
 Evidence(ladder) → Finding → Obligation → Consequence
        └──── Confidence (evidence-fed, per finding) ────┘
                        → Recommendation (calm, finding-aware)
        ── reads, never writes ──▼
 FROZEN CORE: 5 dimensions · weights · composite · maturity bands
```

### Readiness posture (honest)

- **Conditional-Go:** Government Advisory, Crown Corporation, Municipal, Pilot.
- **No-Go until inter-rater reliability is measured:** Regulator endorsement.

> **Data handling for this session:** see the
> [Security & Data-Handling Brief](../SECURITY_AND_DATA_HANDLING_BRIEF.md) —
> what is collected, what is not, residency, retention, access, anonymization,
> the AI boundary, and withdrawal/export/deletion. The *derived* persisted
> artifacts (scoring trace, findings, traceability record) are **designed to
> exclude direct personal identifiers by schema** and are covered by an
> automated PII-marker regression test. The complete data flow — including
> the source `Answer.note` free-text field and the security-assurance items
> that remain per-engagement — is not yet independently attested (see
> [IMPLEMENTATION_STATUS.md §3](../IMPLEMENTATION_STATUS.md#3-security-privacy-and-data-handling)).

---

## Part 2 — One finding rendered through the seven-answer contract

> **Illustrative example — not an exact reproduction.** The numeric values,
> version stamps (`vX`/`vY`), and "e.g." contributions below are chosen to make
> the *shape* of the chain legible on one page. For an exact, byte-reproducible
> fixture with commit SHA, canonical-payload hash, and pinned scoring/question-
> bank versions, see the reproducible fixture referenced in
> [EVIDENCE_MANIFEST.md](../EVIDENCE_MANIFEST.md).

A single, concrete worked example. Every value below is a **persisted field**;
the prose is rendered *from* the fields, never invented.

> **FINDING `f.succession_authority_undocumented`**
> *"Succession authority for the executive director is undocumented."*

### 1 — What evidence was observed?

- **Evidence level:** `VERBAL` (interview statements only; no delegation
  instrument or board resolution produced).
- **Reviewer credit:** `oral`.
- **Corroboration:** none (single source).

### 2 — What finding did it produce?

- Deterministic assertion from `questionTraces` on `Q-GOV-03` (delegation of
  authority documented?) and `Q-OPS-07` (single-person dependency?).
- `findingId: f.succession_authority_undocumented`, `severity: serious`.

### 3 — What obligation does it affect?

- **Governance** (Tier 4) — delegation/oversight framework gap.
- **Fiduciary** (Tier 3) — prudence/care duty re: continuity of authority.
- **Continuity** (Tier 6) — function preserved across transition.
- **Statutory: NOT asserted** — evidence is `VERBAL`, below the `DOCUMENTED`
  evidence floor required to allege a statutory breach. *(This restraint is the
  point: the system refuses to over-claim.)*
- **Lead framing:** Fiduciary (highest tier present).

### 3B — Which specific instrument creates the obligation? *(Phase G)*

- **Governance → candidate source-instrument record:** `si.governance_bylaws`
  — institutional governance bylaws / delegation instrument. **`referenced`,
  not asserted:** evidence (`VERBAL`) is below the `DOCUMENTED` floor; and the
  instrument itself is **`UNVERIFIED`**, so the citation is **not
  `defensible`**.
- **Statutory → candidate source-instrument record:** `si.enabling_statute`
  — **withheld / referenced only.** A statute is never `asserted` below
  `VERIFIED` evidence.
- **No clause number is shown.** `clauseRef` is `null` until an authorised
  policy owner or qualified counsel confirms it. *The system names where a
  citation would go; it does not fabricate one.*
- Please identify which entries you can assess from a public-administration
  perspective, which require confirmation by the responsible **policy owner**
  inside a sponsoring institution, and which require **qualified legal
  counsel** before any `verificationStatus` may be promoted to
  `VALIDATOR_CONFIRMED`.
- Context: [Source Instrument Traceability](../OCI_OCRA_SOURCE_INSTRUMENT_TRACEABILITY.md).

### 4 — What dimension does it affect, and by how much?

- Contributes to `transition_readiness` (continuity-positive dimension) and
  **reduces** the continuity-positive `governance_resilience` dimension.
  (Earlier drafts said *"elevates governance_fragility"*; that framing was
  ambiguous after the fragility → resilience inversion and has been retired.)
- Exact weighted contribution is read from
  `questionTraces[].dimensionContributions` — e.g. `Q-GOV-03` answer
  `effectiveScore = 0.25`, weight to `transition_readiness = 0.40` →
  contribution `0.10`. **The traceability layer reads this; it does not
  compute or alter it.**

### 5 — What is the confidence?

- **Band: `LOW`.** Composition takes the **lowest** contributing band:
  evidence band (`VERBAL → LOW`) caps the result; `LIMITED_GOVERNANCE_EVIDENCE`
  caution raised.
- **Rationale (attached):** `["evidence: VERBAL (band LOW)", "single source — no
  corroboration", "final confidence: LOW"]`.
- **No probability is stated.** Ordinal band only.

### 6 — What is the consequence?

- **Classes:** Institutional, Service Delivery (realization trigger: *unplanned
  departure*).
- **Confidence-gated:** because confidence is `LOW`, the consequence is stated as
  **potential**, not asserted as fact:
  > "An unplanned departure *could* strand signing authority for the program. This
  > is a standing exposure; it has not been independently evidenced."

### 7 — What is the recommended action?

- `rec.governance_workshop` (+ document delegation of authority).
- **Calm, non-coercive, sovereignty-preserving.** No manufactured urgency.
- Traces to this finding (no orphan recommendation).

### Chain-integrity attestation (institution-level, one line)

> ✅ Every surfaced finding is evidence-linked, obligation-mapped,
> confidence-bounded, and recommendation-complete. Scoring version and
> obligation taxonomy version are pinned per assessment; see
> [EVIDENCE_MANIFEST.md](../EVIDENCE_MANIFEST.md) for the exact version stamps,
> commit SHA, and canonical-payload hash of the reproducible fixture.

---

## Part 3 — Five decisions only a senior public-sector reviewer can make

The fifteen questions previously spread across Parts 3, 3B, and 3C have been
consolidated into **five core decisions** an external reviewer is genuinely
best placed to make. The prior fifteen (source-instrument nuance, assessor-
certification detail, confidence-vs-usability trade-offs) remain in the
[Validation Workbook](./VALIDATION_WORKBOOK.md) as prompts under O2–O11 for a
reviewer who wants to go deeper. This section is the honest short list.

1. **Category credibility.** Is *"institutional continuity"* — framed as the
   human/governance continuity fabric that ISO 22301 BCMS *assumes but does
   not measure* — a credible, non-overclaiming category to a deputy minister,
   an Auditor General, and a Public Accounts Committee? What language would
   you defend in that room?

2. **Evidence → confidence → obligation coupling.** OCI/OCRA refuses to
   assert a **Statutory** obligation below `DOCUMENTED` evidence and never
   emits a probability (only ordinal `HIGH/MODERATE/LOW/INSUFFICIENT` with
   attached rationale). Is that coupling defensible and usable to a
   public-sector buyer, or is it either too permissive (still cites law under
   uncertainty) or too austere (feels evasive to a decision-maker)?

3. **Obligation-hierarchy posture.** When obligations conflict (operational
   efficiency vs. a regulatory control duty; fiduciary care vs. reputational
   management), OCI/OCRA **names the tension, leads with the higher tier,
   and never numerically arbitrates.** Obligations never touch the score. Is
   "name it, don't net it" the defensible public-sector posture, and is the
   seven-class taxonomy (Statutory, Regulatory, Fiduciary, Governance,
   Procedural, Operational, Continuity) the right shape — or are categories
   missing?

4. **Blocker to a real Crown/municipal pilot.** Given the honest open items
   in [IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md) — unmeasured
   inter-rater reliability, an unverified source-instrument catalogue, zero
   certified assessors, security-assurance items that are `PROPOSED`
   per-engagement, no executed pilot, and no legal/commercial packet —
   **what is the single item most likely to block a Crown corporation or
   municipality from proceeding**, and what evidence would unblock it?

5. **Where specialist review is required.** Which of the open items in this
   packet can you assess directly from a public-administration perspective,
   which require confirmation by the responsible **policy owner** inside a
   sponsoring institution, and which require **qualified counsel, a security
   auditor, a procurement authority, or a methodology specialist** before an
   external claim is defensible? A short attribution of *who* must sign off
   on *what* is more valuable than a single overall verdict.

> **Legal, security, and procurement scope.** Verifying legal instruments,
> attesting security controls, and shaping commercial/liability terms are
> **out of scope** for this validation. Where an item requires that
> expertise, please flag it and (if possible) suggest the profile of
> reviewer we should engage next. There is no expectation of endorsement:
> the deliverable is independent judgment and a next-step recommendation.

---

## Part 4 — How to use this packet

1. Read Part 1 (5 minutes).
2. Walk Part 2 with the scoring trace open; try to break the chain.
3. Answer Part 3's five decisions in writing.
4. Optionally, use the [Validation Workbook](./VALIDATION_WORKBOOK.md) to record
   objective-level verdicts (O1–O11) with conditions.
5. Return your independent verdicts on the reviewer response form (do **not**
   fill in Nzila's internal pre-mortem; that is a self-critique, not your
   deliverable).
