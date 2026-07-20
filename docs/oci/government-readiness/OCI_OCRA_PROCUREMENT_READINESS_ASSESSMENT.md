# OCI / OCRA Procurement Readiness Assessment

> **Status:** Blueprint — Architecture Review Only (no implementation)
> **Audience:** Procurement evaluators, crown corporation leadership, deputy ministers, vendors of record reviewers
> **Method:** Current State → Target State → Gap Analysis → Roadmap, evaluated
> against five procurement archetypes

---

## 1. Procurement archetypes evaluated

| # | Archetype | What they buy | What they scrutinize hardest |
| --- | --- | --- | --- |
| A | **Government Advisory** (deputy minister / central agency) | Decision-grade institutional risk briefs | Traceability, defensibility, neutrality |
| B | **Crown Corporation** | Continuity/governance assurance at arm's length | Methodology rigor, benchmark honesty |
| C | **Regulator** | A defensible instrument they could endorse/require | Validation, IRR, bias, evidence basis |
| D | **Municipal** | Affordable, explainable continuity insight | Clarity, cost, privacy |
| E | **Public-Sector Pilot** | Low-risk proof with a credible path to scale | Backward-compat, data handling, exit |

---

## 2. Readiness scorecard (current state)

Legend: ✅ strong · ◐ partial · ○ gap

| Capability | A | B | C | D | E | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Deterministic, reproducible scoring | ✅ | ✅ | ✅ | ✅ | ✅ | `ScoringTrace`, frozen core |
| Fairness / no sector gaming | ✅ | ✅ | ✅ | ✅ | ✅ | context → interpretation only |
| Confidence model | ✅ | ✅ | ◐ | ✅ | ✅ | exists; not yet evidence-fed/per-finding |
| Evidence basis | ◐ | ◐ | ◐ | ◐ | ◐ | 6-level ladder exists, not surfaced per finding |
| **Obligation traceability** | ○ | ○ | ○ | ○ | ○ | **no obligation layer yet** |
| **Explainability (7-answer)** | ◐ | ◐ | ○ | ◐ | ◐ | trace exists; finding artifact missing |
| **Consequence framing** | ○ | ○ | ○ | ◐ | ◐ | no formal consequence model |
| Benchmark governance | ◐ | ◐ | ◐ | ◐ | ◐ | K=5 + characteristic baselines; publication rules uncodified |
| **Inter-rater reliability** | ○ | ○ | ○ | ◐ | ◐ | variance hook exists; not measured |
| Privacy / anti-surveillance | ✅ | ✅ | ✅ | ✅ | ✅ | constitutive; k-anonymity; no PII in traces |
| AI governance | ✅ | ✅ | ✅ | ✅ | ✅ | 5-layer boundary; AI never scores |
| Standards crosswalks | ◐ | ◐ | ◐ | ◐ | ◐ | ISO 22301/31000/37000, COBIT exist |
| Auditability | ◐ | ◐ | ○ | ◐ | ◐ | strong trace; needs chain-integrity attestation |
| Security posture | ◐ | ◐ | ◐ | ◐ | ◐ | platform-level; not yet packaged for gov review |

**Reading:** the deterministic, fairness, privacy, and AI-governance columns are
the strongest components of the architecture today; empirical calibration and
external attestations remain to be earned. The gaps cluster in exactly the areas
the government-readiness layer addresses: obligation traceability, explainability
finding artifacts, consequence framing, benchmark publication rules, and IRR —
plus the security, legal, and pilot items tracked in
[IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md).

---

## 3. Gap analysis (by domain)

### 3.1 Methodology

- ◐ **Confidence not evidence-fed.** Wire the evidence ladder into the envelope
  (see [confidence architecture](./OCI_OCRA_CONFIDENCE_ARCHITECTURE.md)).
- ○ **No finding artifact.** Introduce the deterministic Finding (see
  [traceability](./OCI_OCRA_POLICY_TRACEABILITY_ARCHITECTURE.md)).

### 3.2 Governance / accountability

- ○ **No obligation taxonomy.** Adopt the seven-class model (see
  [obligation taxonomy](./OCI_OCRA_OBLIGATION_TAXONOMY.md)).
- ○ **No consequence model.** Adopt the six-class model (see
  [consequence model](./OCI_OCRA_CONSEQUENCE_MODEL.md)).

### 3.3 Validation

- ○ **IRR unmeasured.** Stand up the IRR program (see
  [IRR model](./OCI_OCRA_INTER_RATER_RELIABILITY_MODEL.md)).
- ◐ **Coefficients practitioner-informed.** Honest today; calibration roadmap
  needed for Regulator (C).

### 3.4 Evidence

- ◐ **Ladder not surfaced.** Make evidence level a first-class per-finding field.

### 3.5 Reporting

- ◐ **Explainability incomplete.** Enforce the seven-answer contract (see
  [explainability model](./OCI_OCRA_EXPLAINABILITY_MODEL.md)).
- ○ **No chain-integrity attestation** in reports.

### 3.6 Auditability

- ◐ Strong traces exist; package a **reconstruction pack** (answers → findings →
  obligations → scores) for auditor depth.

### 3.7 Privacy

- ✅ Strong. Document the no-PII-in-traces and k-anonymity guarantees in
  procurement language.

### 3.8 Security

- ◐ Inherit platform security; produce a **security & data-handling brief**
  (residency, retention, access) for pilot (E) and municipal (D).

### 3.9 Benchmarking

- ◐ Codify cohort minimums and the safe/unsafe claim catalogue (see
  [benchmark governance](./OCI_OCRA_BENCHMARK_GOVERNANCE_REVIEW.md)).

---

## 4. Target state (per archetype)

| Archetype | Minimum bar to win | Critical gap to close first |
| --- | --- | --- |
| A — Advisory | Traceability + consequence framing | Obligation + consequence layers |
| B — Crown Corp | Methodology rigor + benchmark honesty | Benchmark publication rules + confidence-per-finding |
| C — Regulator | Validation + IRR + bias defense | **IRR program + calibration roadmap** (highest bar) |
| D — Municipal | Clarity + cost + privacy | Explainability finding artifact + plain reports |
| E — Pilot | Backward-compat + data handling + exit | Security/data brief + chain-integrity attestation |

---

## 5. Roadmap (architecture sequencing — no implementation here)

> Documentation/architecture phases only; each preserves the frozen core.

1. **Foundation (doctrine):** ratify obligation taxonomy, consequence model,
   confidence evolution, explainability contract, benchmark publication rules.
   *(this blueprint set)*
2. **Traceability layer (schema design):** Finding artifact + traceability record
   shape + chain-integrity invariants. *(design only)*
3. **Reporting upgrade (design):** seven-answer rendering at three depths +
   chain-integrity attestation.
4. **Benchmark governance (process):** cohort floors, safe/unsafe catalogue,
   honesty clause, ethics gate wiring.
5. **IRR program (study design):** calibration set + paired-blind protocol +
   thresholds.
6. **Procurement packaging:** security/data-handling brief, crosswalk dossier,
   reconstruction pack template.
7. **Validation gate (Phase 12):** non-regression suites for traceability,
   obligation mapping, confidence determinism, explainability completeness — on
   top of existing determinism/fairness/monotonicity guards.

**Sequencing logic:** doctrine before schema before reporting; IRR and benchmark
governance proceed in parallel; the Regulator archetype (C) is gated on IRR and is
therefore the **last** to fully mature — set expectations accordingly.

---

## 6. Risks & tradeoffs

| Risk | Mitigation |
| --- | --- |
| Over-claiming readiness for Regulator (C) before IRR exists | Stage claims; lead with A/B/D/E; disclose IRR roadmap honestly |
| New layers add reporting complexity | Three-depth explainability keeps executive view to one line per finding |
| Obligation catalogue becomes legal-adjacent maintenance burden | Version + govern the taxonomy; keep model universal, citations sector-scoped |
| Procurement reads "practitioner-informed coefficients" as weakness | Frame as honesty + pair with calibration roadmap |
| Scope creep into a government overlay | Architecture decision forbids it; freeze enforced by validation |

---

## 7. Executive verdict

> OCI/OCRA is a **candidate for procurement-oriented validation on the
> hardest-to-fake architectural dimensions** — determinism, fairness, privacy,
> and AI governance. Its gaps are **additive and well-scoped**: obligation
> traceability, a finding-level explainability contract, a consequence model,
> codified benchmark publication rules, a measured IRR program, verified
> source instruments, a certified assessor corps, externally attested
> security controls, a legal/commercial packet, and an executed pilot. None
> require touching the scoring core. With the government-readiness layer in
> place and those gates closing in sequence, OCI/OCRA can credibly enter
> Advisory, Crown Corporation, Municipal, and Pilot procurement-oriented
> conversations now, with Regulator endorsement following the IRR program.
> The honest framing — strong core, named gaps, clear
> roadmap — is itself a procurement advantage in public-sector evaluation.
