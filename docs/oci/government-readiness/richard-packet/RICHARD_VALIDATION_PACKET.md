# Richard Sharpe Validation Packet

> **Status:** Validation packet — for senior public-sector review.
> **Purpose:** Everything Richard Sharpe needs in one place to validate the
> OCI/OCRA government-readiness architecture: a one-page summary, one finding
> rendered end-to-end, the five decisions only he can make, and a pointer to the
> structured workbook.
> **Protocol:** [RICHARD_SHARPE_VALIDATION_PROTOCOL.md](../RICHARD_SHARPE_VALIDATION_PROTOCOL.md)
> · **Workbook:** [VALIDATION_WORKBOOK.md](./VALIDATION_WORKBOOK.md)

---

## Part 1 — One-page architecture summary

### The claim

> OCI/OCRA becomes government-grade **without changing how it scores**. We add a
> read-only **traceability / obligation / consequence / confidence /
> explainability** layer above a **frozen, validated, universal scoring core.**

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
> the AI boundary, and withdrawal/export/deletion. Persisted artifacts are
> PII-free by construction and verified by automated tests.

---

## Part 2 — One finding rendered through the seven-answer contract

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

- **Governance → candidate source:** `si.governance_bylaws` — institutional
  governance bylaws / delegation instrument. **`referenced`, not asserted:**
  evidence (`VERBAL`) is below the `DOCUMENTED` floor; and the instrument itself is
  **`UNVERIFIED`**, so the citation is **not `defensible`**.
- **Statutory → candidate source:** `si.enabling_statute` — **withheld/referenced
  only.** A statute is never `asserted` below `VERIFIED` evidence.
- **No clause number is shown.** `clauseRef` is `null` until a validator confirms
  it. *The system names where a citation would go; it does not fabricate one.*
- This is the step a deputy minister actually probes. See
  [Source Instrument Traceability](../OCI_OCRA_SOURCE_INSTRUMENT_TRACEABILITY.md).

### 4 — What dimension does it affect, and by how much?

- Contributes to `transition_readiness` (continuity-positive) and elevates
  `governance_fragility` (risk dimension, inverted before composition).
- Exact weighted contribution is read from
  `questionTraces[].dimensionContributions` — e.g. `Q-GOV-03` answer
  `effectiveScore = 0.25`, weight to `transition_readiness = 0.40` →
  contribution `0.10`. **The traceability layer reads this; it does not compute or
  alter it.**

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
> confidence-bounded, and recommendation-complete. Scoring version `vX`,
> obligation taxonomy version `vY`.

---

## Part 3 — Five questions for Richard

These are the decisions the architecture **cannot make for itself** — they require
senior public-sector judgment.

1. **Category language.** Is *"institutional continuity"* a credible,
   non-overclaiming category to a deputy minister and an auditor general — framed
   as the human/governance continuity fabric that ISO 22301 BCMS *assumes but does
   not measure* — or does it read as risk management rebranded? *(What language
   would you defend in a public accounts committee?)*

2. **Statutory evidence floor.** We refuse to assert a **Statutory** obligation on
   anything below `DOCUMENTED` evidence. Is `DOCUMENTED` the right floor, or should
   statutory implications require `VERIFIED`/`CROSS_VALIDATED`? *(Where is the line
   between useful and reckless?)*

3. **Obligation conflict handling.** When obligations conflict (e.g. operational
   efficiency vs. a regulatory control duty), we **name the tension, lead with the
   higher tier, and never numerically arbitrate** (obligations never touch the
   score). Is "name it, don't net it" the defensible public-sector posture?

4. **Confidence honesty vs. usability.** We publish only ordinal bands
   (HIGH/MODERATE/LOW/INSUFFICIENT) with rationale, never a percentage, and a
   weak factor *caps* the whole envelope. Does this conservative, non-probabilistic
   posture satisfy auditor scrutiny without making the product feel evasive to a
   buyer?

5. **Regulator staging.** We hold **Regulator** endorsement at **No-Go until
   inter-rater reliability is measured**, while pursuing Advisory/Crown/Municipal/
   Pilot now. Is staged, disclosed honesty the right go-to-market — or does the IRR
   gap need to close *before* any public-sector engagement?

---

## Part 3B — Five questions on source-instrument traceability (Phase G)

The highest-leverage gap is no longer privacy — it is *"show me the **specific**
obligation."* Phase G extends the chain to **Source Instrument → Citation** but
seeds the catalogue as **entirely `UNVERIFIED`** (no asserted clause numbers).
These five questions are the ones a deputy minister, Auditor General, or Public
Accounts Committee will actually press on:

1. **Missing obligation categories.** If you were defending this assessment before
   Treasury Board, an Auditor General, or a Public Accounts Committee, **what
   obligation categories are missing** from the seven-class taxonomy?

2. **Citation-mandatory classes.** **Which obligation classes should *always* be
   supported by an explicit citation** before they may be surfaced at all (vs.
   classes where a named-but-`referenced` candidate is acceptable)?

3. **Evidence threshold for citing law.** **At what evidence threshold should
   OCI/OCRA be allowed to reference a statute, policy, directive, or mandate
   letter?** Our current floors: statute/regulation = `VERIFIED`; policy/
   directive/standard/TB-instrument/bylaw/mandate = `DOCUMENTED`. Raise? Lower?

4. **Act-without-a-consultant test.** **What would make a deputy minister trust
   the finding artifact enough to act without a consultant in the room?** Which
   fields, attestations, or citation states are the unlock?

5. **Unanticipated procurement questions.** **Which public-sector procurement
   questions are we not anticipating** — in the security/data brief, the
   traceability chain, or the source-instrument model?

> For each confirmed instrument, Richard (or counsel) supplies the correct
> `clauseRef` and promotes `verificationStatus` to `VALIDATOR_CONFIRMED`. Only then
> does a citation become `defensible` at and above its evidence floor.

---

## Part 3C — Five questions on assessor governance & procurement defensibility

The session also tests two governance objectives beyond the methodology itself:
**who may conduct OCI/OCRA** (O10) and **whether a public body can defend acting on
its findings** (O11). See the
[Assessor Certification & Governance Standard](../OCI_OCRA_ASSESSOR_CERTIFICATION_STANDARD.md)
and the [Validation Binder](../OCI_OCRA_VALIDATION_BINDER.md).

1. **Certification levels.** The standard defines five assessor levels (Trained →
   Calibration Authority), with independent assessment gated at **Level 3**. Are
   five levels — and that gate — the right shape for a Crown corporation or
   ministry to adopt as policy?

2. **Calibration bar.** An assessor's calibration is judged against the **same IRR
   thresholds** the program uses for procurement (κ ≥ 0.60, ICC ≥ 0.80, band-exact
   ≥ 0.70), so the personal bar can never drift below the program bar. Is reusing
   the procurement IRR thresholds as the *individual* calibration gate defensible?

3. **Suspend-by-default.** Standing is suspend-dominant: drift, lapsed
   recertification, or under-sampling each suspends live-assessment authority until
   remediated. Is "suspend first, restore on evidence" the posture an Auditor
   General would expect?

4. **The committee-challenge test.** A department acts on a finding and is
   challenged at a parliamentary or board committee. Walk the chain that survives:
   evidence → finding → obligation → (validated) authority → confidence →
   consequence → certified assessor. **What single link is most likely to break,
   and what hardens it?**

5. **Residual gap honesty.** The Procurement Readiness Assessment holds Regulator
   at 9.5/10 — the final half-point earned only with **measured real-world IRR
   data**. Is disclosing that residual limit a procurement asset, or should it be
   closed before any regulator conversation?

> **Objective mapping for the workbook:** Part 3B feeds **O9** (source-instrument
> traceability); Part 3C questions 1–3 feed **O10** (assessor governance); Part 3C
> questions 4–5 feed **O11** (procurement defensibility).

---

## Part 4 — How to use this packet

1. Read Part 1 (5 minutes).
2. Walk Part 2 with the scoring trace open; try to break the chain.
3. Answer Parts 3, 3B, and 3C in writing.
4. Complete the [validation workbook](./VALIDATION_WORKBOOK.md) — one verdict per
   objective (O1–O11), with conditions.
5. Record dispositions in
   [GOVERNMENT_VALIDATION_REPORT_V1.md](../GOVERNMENT_VALIDATION_REPORT_V1.md).
