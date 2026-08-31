# Internal Pre-Mortem — Hypothetical Reviewer Challenges

> **⚠️ NOT FOR EXTERNAL DISTRIBUTION.** This is an *internal* pre-mortem
> exercise, written by the Nzila team to stress-test the OCI/OCRA
> government-readiness architecture against the questions a senior
> public-sector reviewer would plausibly raise. **It does not represent the
> views of, and has not been reviewed by, any external validator (named or
> unnamed).**
>
> **Status:** Internal red-team exercise — architecture pre-mortem only.
> **Author:** Nzila platform team (self-critique, not external validation).
> **Protocol authored against:** [RICHARD_SHARPE_VALIDATION_PROTOCOL.md](RICHARD_SHARPE_VALIDATION_PROTOCOL.md).
> **Disposition:** Internal planning artifact against the *proposed*
> architecture; not a certification of a shipped system and not an
> endorsement by any external party.
>
> The verdicts below are the Nzila team's own self-assessed dispositions,
> written in the voice of a hypothetical senior public-sector reviewer as a
> disciplined red-team exercise. External validation is a separate,
> not-yet-completed track — see
> [external-send/](./richard-packet/external-send/).

---

## 1. Executive summary

The OCI/OCRA government-readiness architecture is **fundamentally sound and
defensible**, conditional on building the additive traceability/obligation/
consequence/IRR layer it specifies. The hypothetical reviewer's central
conclusion (as imagined by the Nzila team in this pre-mortem) mirrors the
architecture decision: **the strength is the frozen, deterministic, fair core;
government readiness is a legibility and evidence-governance problem, not a scoring
problem.**

- **Advisory & Crown Corporation:** **Conditional-Go** — strong now; close
  obligation + consequence + explainability finding artifact.
- **Municipal & Pilot:** **Conditional-Go** — close explainability + security/data
  brief.
- **Regulator:** **No-Go until IRR measured** — honest roadmap required; do not
  over-claim.

---

## 2. Verdicts by objective

| # | Objective | Verdict | Key condition |
| --- | --- | --- | --- |
| O1 | Category language | **Validated-with-conditions** | Frame as "the human-continuity layer BCMS assumes," not a risk rebrand |
| O2 | Policy traceability | **Validated-with-conditions** | Build the explicit Finding artifact; prove chain-integrity invariants |
| O3 | Obligation taxonomy | **Validated-with-conditions** | Confirm catalogue selection is sector-scoped citations, never score forks |
| O4 | Confidence model | **Validated** | Keep `min`-band composition; wire evidence ladder; never publish a % |
| O5 | Explainability | **Validated-with-conditions** | Enforce seven-answer completeness gate before any finding surfaces |
| O6 | Procurement assumptions | **Validated-with-conditions** | Stage Regulator claims behind IRR; lead with A/B/D/E |
| O7 | Pilot targets | **Validated** | Two concrete candidates identified (§4) |
| O8 | Objection harvest | **Validated** | Objection register produced (§5) |

No objective received `Not yet defensible`. O1–O5 are clearable with the
additive layer; none require touching the scoring core.

---

## 3. Objective detail

### O1 — Category language

- **Challenge:** "Is institutional continuity just risk management rebranded?"
- **Defense:** OCI/OCRA measures the **human and governance continuity fabric**
  (operational memory, succession survivability, decision traceability) that BCM
  standards (ISO 22301) *assume but do not measure*. The ISO/COBIT crosswalks
  demonstrate complementarity, not overlap.
- **Condition:** lead messaging with complementarity; avoid "risk score" language.

### O2 — Policy traceability

- **Challenge:** "Reconstruct finding → recommendation with no hand-waving."
- **Defense:** the chain is deterministic and persistable (`ScoringTrace` already
  proves the score half; the Finding artifact + obligation map complete it).
- **Condition:** implement the Finding artifact and the `chainIntegrity` invariants
  (no orphan findings/recommendations).

### O3 — Obligation taxonomy

- **Challenge:** "Statutory vs operational obligations conflict — what does the
  report say?"
- **Defense:** conflicts are **named, higher tier leads framing, no numeric
  arbitration** (obligations never feed score).
- **Condition:** confirm sector context selects *catalogues of citations* only,
  preserving the comparability invariant.

### O4 — Confidence model

- **Challenge:** "Three interviews, no documents — why trust your confidence?"
- **Defense:** evidence-fed `min`-band composition caps confidence at the weakest
  factor; VERBAL evidence → LOW; no probability claim; rationale attached.
- **Verdict:** **Validated** — this is exactly the conservative posture a public
  accounts committee expects.

### O5 — Explainability

- **Challenge:** "Reconstruct a department's flag for an MP, no analyst present."
- **Defense:** the seven-answer contract renders from persisted fields at auditor
  depth; AI may phrase but never originate answers.
- **Condition:** enforce the completeness gate (suppress any finding missing one
  of the seven answers).

### O6 — Procurement assumptions

- **Challenge:** "You claim regulator-readiness — show IRR."
- **Defense:** the assessment **does not** claim regulator-readiness; it stages it
  behind the IRR program and discloses the gap.
- **Condition:** keep Regulator at No-Go until IRR thresholds are met.

### O7 — Pilot targets

- See §4.

### O8 — Objection harvest

- See §5.

---

## 4. Recommended pilot candidates

| Candidate profile | Why | Primary failure mode |
| --- | --- | --- |
| **Crown corporation undergoing leadership transition** | High continuity exposure + motivated sponsor; consequence model lands directly | Sponsor treats it as an HR exercise; mitigate by board-level framing |
| **Mid-sized municipality with COOP mandate** | Clear obligation (Continuity/Policy), affordable, explainability shines | Capacity to act on findings; mitigate with calm, staged recommendations |

A regulator pilot is **deferred** until IRR evidence exists.

---

## 5. Objection register (top objections + mitigations)

| # | Objection (hostile auditor/regulator) | Mitigation |
| --- | --- | --- |
| 1 | "Coefficients aren't empirically calibrated." | Disclosed honestly (v1.0.0 practitioner-informed); calibration roadmap; scores are deterministic and transparent regardless |
| 2 | "It's reviewer-led — two reviewers might disagree." | Most reviewer judgment affects confidence/narrative, not score; IRR program measures and feeds disagreement into confidence |
| 3 | "Benchmarks could stigmatize an institution." | No rankings; characteristic (non-normative) baselines; K≥5; honesty clause; refusal-first ethics gate |
| 4 | "Is this surveillance of public servants?" | Constitutive anti-surveillance; no PII in traces; institutional, not individual, findings; AI never profiles |
| 5 | "Why should we trust an AI to judge our institution?" | AI never scores/decides; five-layer boundary; all findings deterministic and reviewer-credited |
| 6 | "Government is different — where's your government model?" | Deliberately *no* sector overlay; same universal scale + obligation-language layer; preserves fairness and benchmark integrity |

---

## 6. Conditions register (ordered)

1. Build the **Finding artifact** + chain-integrity invariants (O2, O5).
2. Ratify and version the **obligation taxonomy**; confirm citation-only sector
   scoping (O3).
3. Wire the **evidence ladder into confidence**; per-finding envelopes (O4).
4. Enforce the **seven-answer completeness gate** in reporting (O5).
5. Codify **benchmark publication rules** (safe/unsafe catalogue, cohort floors).
6. Stand up the **IRR program**; gate Regulator positioning on it (O6).
7. Produce the **security/data-handling + crosswalk dossiers** for pilots.

---

## 7. Final disposition

> **Conditional-Go** for Advisory, Crown Corporation, Municipal, and Pilot
> procurement, subject to the ordered conditions register. **No-Go** for Regulator
> endorsement until inter-rater reliability is measured to threshold. The
> architecture is defensible; the gaps are additive, named, and non-core. The
> recommended posture is to build the traceability/obligation/explainability layer,
> run two staged pilots, stand up the IRR program in parallel, and disclose every
> limitation in writing — because in public-sector evaluation, demonstrated honesty
> about limits is itself a competitive advantage.
