# OCI/OCRA Government Validation Workbook

> **Status:** Working document — to be completed by the validator (Richard Sharpe).
> **Pairs with:** [RICHARD_VALIDATION_PACKET.md](./RICHARD_VALIDATION_PACKET.md)
> · [RICHARD_SHARPE_VALIDATION_PROTOCOL.md](../RICHARD_SHARPE_VALIDATION_PROTOCOL.md)
> **Output target:** verdicts feed
> [GOVERNMENT_VALIDATION_REPORT_V1.md](../GOVERNMENT_VALIDATION_REPORT_V1.md)

This workbook is a structured worksheet. Each objective has a fixed format:
**Claim → Challenge → Evidence → Verdict → Conditions.** Verdicts are one of:
`Validated` · `Validated-with-conditions` · `Not yet defensible`.

---

## How to score a verdict

| Verdict | Meaning | Required to proceed? |
| --- | --- | --- |
| **Validated** | Defensible as-is to a hostile auditor/regulator | — |
| **Validated-with-conditions** | Defensible once named, testable conditions are met | List conditions |
| **Not yet defensible** | Blocks government positioning until remediated | Blocks O1–O5 |

**Gate rule:** O1, O2, O3, O5 must be ≥ `Validated-with-conditions` and O4 must be
`Validated` to position for Advisory/Crown. A `Not yet defensible` on O1–O5 is a
program blocker.

---

## O1 — Institutional-intelligence category language

- **Claim:** "Institutional continuity" is the human/governance continuity fabric
  that ISO 22301 BCMS assumes but does not measure — a complement, not a rebrand.
- **Challenge to run:** *"Auditor general asks: is this just risk management
  rebranded?"*
- **Evidence to inspect:** ISO 22301 / 31000 / 37000 / COBIT crosswalks;
  dimension definitions; signature frameworks (SDI, GES, CBM, CSM, RBI).
- **Verdict:** ☐ Validated ☐ Validated-with-conditions ☐ Not yet defensible
- **Conditions / notes:**
  > _______________________________________________________________

## O2 — Policy traceability chain

- **Claim:** Evidence → Finding → Obligation → Dimension → Consequence →
  Recommendation reconstructs deterministically, with no orphan findings or
  recommendations.
- **Challenge:** *"Reconstruct finding → recommendation with no hand-waving."*
- **Evidence:** worked example in packet Part 2; `ScoringTrace`;
  `chainIntegrity` invariants; traceability architecture doc.
- **Verdict:** ☐ Validated ☐ Validated-with-conditions ☐ Not yet defensible
- **Conditions / notes:**
  > _______________________________________________________________

## O3 — Obligation taxonomy

- **Claim:** Seven classes + tier hierarchy match how government reasons about
  duty; conflicts are named, never numerically arbitrated; obligations never feed
  the score; sector context selects citation catalogues only.
- **Challenge:** *"A statutory and an operational obligation conflict — what does
  the report say?"*
- **Evidence:** obligation taxonomy doc §4–§6; sample finding obligation block.
- **Verdict:** ☐ Validated ☐ Validated-with-conditions ☐ Not yet defensible
- **Conditions / notes:**
  > _______________________________________________________________

## O4 — Confidence model *(must reach Validated)*

- **Claim:** Conservative `min`-band composition; evidence-fed; ordinal only (no
  probability); a weak factor caps the envelope; rationale always attached.
- **Challenge:** *"Three interviews, no documents — why trust your confidence?"*
- **Evidence:** confidence architecture doc; `@nzila/oci-confidence` envelope;
  sample finding answer 5.
- **Verdict:** ☐ Validated ☐ Validated-with-conditions ☐ Not yet defensible
- **Conditions / notes:**
  > _______________________________________________________________

## O5 — Explainability

- **Claim:** Every surfaced finding satisfies the seven-answer contract and is
  reconstructable at auditor depth; AI may phrase but never originate answers.
- **Challenge:** *"Reconstruct a department's flag for an MP, with no analyst in
  the room."*
- **Evidence:** explainability model doc; packet Part 2; completeness gate.
- **Verdict:** ☐ Validated ☐ Validated-with-conditions ☐ Not yet defensible
- **Conditions / notes:**
  > _______________________________________________________________

## O6 — Procurement assumptions

- **Claim:** Five-archetype readiness is honestly staged; Regulator held at No-Go
  until IRR measured.
- **Challenge:** *"You claim regulator-readiness — show inter-rater reliability."*
- **Evidence:** procurement assessment scorecard; IRR model roadmap.
- **Verdict:** ☐ Validated ☐ Validated-with-conditions ☐ Not yet defensible
- **Conditions / notes:**
  > _______________________________________________________________

## O7 — Pilot targets

- **Claim:** ≥2 concrete pilot candidates with named failure modes (crown
  corporation in leadership transition; mid-sized municipality with COOP mandate).
- **Challenge:** *"Which institution would you stake a pilot on, and what makes it
  fail?"*
- **Evidence:** validation report §4.
- **Verdict:** ☐ Validated ☐ Validated-with-conditions ☐ Not yet defensible
- **Pilot candidates confirmed / added:**
  > _______________________________________________________________

## O8 — Objection harvest

- **Claim:** The strongest hostile objections are pre-answered with mitigations.
- **Challenge:** *"Give me the three objections you're most afraid of."*
- **Evidence:** validation report §5 objection register.
- **Verdict:** ☐ Validated ☐ Validated-with-conditions ☐ Not yet defensible
- **New objections raised:**
  > _______________________________________________________________

## O9 — Source-instrument traceability

- **Claim:** A finding traces past an abstract obligation *class* to a *specific
  instrument* (statute / regulation / TB instrument / directive / policy / bylaw /
  standard) carrying `authorityLevel` and `effectiveDate`, then to an
  evidence-gated *citation*. The seed catalogue is wholly `UNVERIFIED`: clause
  references and effective dates are `null`; **no citation is defensible** until a
  validator confirms the instrument and the evidence clears the assertion floor.
- **Challenge:** *"Show me the specific authority behind this finding — and prove
  the system isn't inventing a statute or a section number."*
- **Evidence:** [Source Instrument Traceability](../OCI_OCRA_SOURCE_INSTRUMENT_TRACEABILITY.md);
  packet Part 3B; `source-instrument-traceability.test.ts`;
  `source-instrument-authority.test.ts`.
- **Verdict:** ☐ Validated ☐ Validated-with-conditions ☐ Not yet defensible
- **Instruments confirmed / corrected (with clause + effective date):**
  > _______________________________________________________________

## O10 — Assessor governance

- **Claim:** OCI/OCRA is *governed* reviewer-led: a five-level competency standard,
  a calibration gate reusing the IRR thresholds (κ ≥ 0.60, ICC ≥ 0.80, band exact
  ≥ 0.70), annual recertification, minimum sampled reviews per period, and
  suspend-by-default conditions on drift / lapse / under-sampling. Assessors are
  opaque ids; the module never touches a score.
- **Challenge:** *"Who is allowed to conduct OCI/OCRA, and what stops an
  out-of-calibration reviewer from continuing?"*
- **Evidence:** [Assessor Certification & Governance Standard](../OCI_OCRA_ASSESSOR_CERTIFICATION_STANDARD.md);
  `assessor-governance.test.ts`.
- **Verdict:** ☐ Validated ☐ Validated-with-conditions ☐ Not yet defensible
- **Conditions / notes (levels, cadence, thresholds):**
  > _______________________________________________________________

## O11 — Procurement defensibility

- **Claim:** A public body that *acts* on an OCI/OCRA finding can survive
  subsequent scrutiny — the finding is traceable to evidence, an obligation, a
  named (validated) authority, a confidence band, and a consequence, produced by a
  certified assessor, under published benchmark and security discipline.
- **Challenge:** *"A department acts on a flag, then is challenged at committee.
  Walk me through what survives the challenge."*
- **Evidence:** [Validation Binder](../OCI_OCRA_VALIDATION_BINDER.md);
  [Procurement Readiness Assessment](../OCI_OCRA_PROCUREMENT_READINESS_ASSESSMENT.md);
  [Security Brief](../SECURITY_AND_DATA_HANDLING_BRIEF.md).
- **Verdict:** ☐ Validated ☐ Validated-with-conditions ☐ Not yet defensible
- **Residual limit acknowledged (real-world IRR data):**
  > _______________________________________________________________

| # | Scenario | Pass = | Result |
| --- | --- | --- | --- |
| S1 | Reconstruct the sample finding from the answer set alone | Independent re-derivation matches | ☐ |
| S2 | Force an obligation conflict; read the report | Tension named, higher tier leads, no netting | ☐ |
| S3 | Score on interviews only | Confidence `LOW`, consequence stated as *potential* | ☐ |
| S4 | Request a benchmark on a 4-institution cohort | Suppressed (below K=5) | ☐ |
| S5 | Ask for a percentage confidence | Refused; ordinal band + rationale returned | ☐ |
| S6 | Ask "who is the risky person?" | Refused; findings are institutional, no PII | ☐ |
| S7 | Re-run an existing labour assessment post-layer | Identical composite, dimensions, band | ☐ |
| S8 | Ask for the authority behind a finding on UNVERIFIED data | Surfaced as `referenced`/candidate, **not asserted**; never defensible | ☐ |
| S9 | Two instruments claim the same obligation in one jurisdiction | Conflict named, strongest authority leads; tie → human arbitration | ☐ |
| S10 | An assessor's sampled calibration drifts below threshold | Standing → `suspended`; live authority revoked | ☐ |

---

## Consolidated dispositions (transfer to the report)

| Objective | Verdict | Blocking? |
| --- | --- | --- |
| O1 Category language | | |
| O2 Policy traceability | | |
| O3 Obligation taxonomy | | |
| O4 Confidence model | | |
| O5 Explainability | | |
| O6 Procurement assumptions | | |
| O7 Pilot targets | | |
| O8 Objection harvest | | |
| O9 Source-instrument traceability | | |
| O10 Assessor governance | | |
| O11 Procurement defensibility | | |

**Ordered conditions register (output):**

1. _______________________________________________________________
2. _______________________________________________________________
3. _______________________________________________________________

**Final disposition per archetype:**

| Archetype | Go / Conditional-Go / No-Go | Rationale |
| --- | --- | --- |
| Government Advisory | | |
| Crown Corporation | | |
| Municipal | | |
| Public-Sector Pilot | | |
| Regulator | | |

---

## Sign-off

| Field | Value |
| --- | --- |
| Validator | Richard Sharpe |
| Date | __________ |
| Scoring version reviewed | __________ |
| Obligation taxonomy version | __________ |
| Overall recommendation | __________ |
| Signature | __________ |
