# OCI / OCRA Government Readiness — Master Architecture Blueprint

> **Status:** Blueprint — Architecture Review Only (no implementation)
> **Audience:** Senior public-sector executives, deputy ministers, regulators,
> crown corporation leadership, governance professionals, auditors
> **Scope:** Master deliverable consolidating the OCI/OCRA government-readiness
> program. Covers the current-state audit, government validation domains (Phase 5),
> the target architecture, the gap analysis, new doctrine/schema/report/observatory/
> validation requirements, the procurement & Sharpe roadmaps, and the
> non-regression validation strategy (Phase 12).

---

## 0. How to read this set

| Document | Phase | Question it answers |
| --- | --- | --- |
| [Architecture Decision](./GOVERNMENT_READINESS_ARCHITECTURE_DECISION.md) | 1 | What is the minimum architecture change? (and why NOT a sector overlay) |
| [Policy Traceability](./OCI_OCRA_POLICY_TRACEABILITY_ARCHITECTURE.md) | 2 | How does evidence become a recommendation, traceably? |
| [Obligation Taxonomy](./OCI_OCRA_OBLIGATION_TAXONOMY.md) | 3 | What duties does a finding implicate? |
| [Confidence Architecture](./OCI_OCRA_CONFIDENCE_ARCHITECTURE.md) | 4 | How certain are we, honestly? |
| [Explainability Model](./OCI_OCRA_EXPLAINABILITY_MODEL.md) | 6 | Can every finding be reconstructed? |
| [Consequence Model](./OCI_OCRA_CONSEQUENCE_MODEL.md) | 7 | What does this cost the institution? |
| [Benchmark Governance](./OCI_OCRA_BENCHMARK_GOVERNANCE_REVIEW.md) | 8 | What can we safely say vs. peers? |
| [IRR Model](./OCI_OCRA_INTER_RATER_RELIABILITY_MODEL.md) | 9 | Would another reviewer agree? |
| [Procurement Readiness](./OCI_OCRA_PROCUREMENT_READINESS_ASSESSMENT.md) | 10 | Are we ready to be bought? |
| [Sharpe Protocol](./RICHARD_SHARPE_VALIDATION_PROTOCOL.md) + [Validation Report](./GOVERNMENT_VALIDATION_REPORT_V1.md) | 11 | Does it survive senior scrutiny? |
| **This document** | 5 + 12 + master | Government domains, validation strategy, the whole picture |

---

## 1. Current-state architecture audit

### 1.1 What OCI/OCRA is

A deterministic, explainable, anti-surveillance instrument for **institutional
continuity** — the human/governance fabric (operational memory, succession
survivability, decision traceability, transition readiness) that business
continuity standards assume but do not measure.

### 1.2 Verified architecture facts

- **Five dimensions:** `institutional_continuity` (composite source),
  `governance_fragility` (risk), `trust_debt` (risk), `operational_memory`,
  `transition_readiness`.
- **Scoring:** `dimension = Σ(effectiveScore × weight)/Σ(weight) × 100`, rounded;
  risk dims inverted (`1 − raw`); **composite = institutional_continuity**;
  maturity band from composite (5 bands).
- **Full trace:** every number ties to a question answer + published weight
  (`ScoringTrace`).
- **Fairness:** context changes **interpretation labels only**
  (`contextualScoreNormalizer`), never numerics.
- **Adaptation:** routing reads declared context only; **core questions always
  included** (comparability invariant; min 18 routed).
- **Confidence:** `@nzila/oci-confidence` Universal Envelope (`min`-band, ordinal,
  no probability, decay bands, cautions, rationale).
- **Evidence:** six-level ladder `NONE…CROSS_VALIDATED` with reviewer-credit class.
- **Observatory:** opt-in, K=5, characteristic (non-normative) baselines, no
  rankings, refusal-first ethics gate.
- **AI boundary:** five-layer; AI never scores, never determines maturity, never
  routes, never profiles.
- **Standards:** crosswalks to ISO 22301, ISO 31000, ISO 37000, COBIT 2019.
- **Signature frameworks:** Stewardship Density Index, Governance Entropy Scale
  (5 levels), Continuity Burden Map, Continuity Survivability Matrix,
  Reconstruction Burden Index.

### 1.3 Verified gaps

No obligation layer · no explicit Finding artifact · no consequence model · no
measured IRR · evidence ladder not surfaced per finding · benchmark publication
rules uncodified · confidence not yet evidence-fed or per-finding.

### 1.4 Audit conclusion

**The core is world-class and should be frozen.** The gaps are connective and
additive. This is the single most important finding of the entire program.

---

## 2. Government validation domains (Phase 5)

Assessed for coverage **without automatically adding new dimensions.** Verdict
legend: covered ✅ · partial ◐ · gap ○.

| Domain | Coverage | Where it lives today | Evidence probe (how a reviewer tests it) | Recommendation |
| --- | --- | --- | --- | --- |
| **Decision Traceability** | ◐ | `operational_memory`, `transition_readiness`; trace infra | "Show who can sign, where it's documented, and the evidence level." | Surface via Finding + obligation (Governance/Statutory), **no new dimension** |
| **Accountability Architecture** | ◐ | `governance_fragility`, GES, SDI | "Demonstrate the delegation/oversight chain and its gaps." | Map to obligations (Governance/Fiduciary); no new dimension |
| **Program Continuity** | ✅ | `institutional_continuity`, CSM, CBM | "Show survivability under disruption/transition." | Already core; add consequence framing |
| **Institutional Memory** | ✅ | `operational_memory`, RBI | "What is lost if key people leave?" | Already core; add consequence (Institutional) |
| **AI Governance Readiness** | ◐ | AI five-layer boundary; no assessed dimension for the *institution's own* AI use | "Does the institution govern its own automation?" | Add as **question theme + obligation mapping (Policy/Governance)**, not a dimension |
| **Policy Lifecycle Management** | ○ | partial via governance questions | "Can policy be created, reviewed, retired with authority and record?" | Add as **question theme + obligation (Policy/Regulatory)**, not a dimension |

**Domain verdict:** all six are addressable through **questions, evidence,
obligations, and consequences** — the additive layer — **without adding scoring
dimensions.** This preserves benchmark comparability and avoids calibration
multiplication. Two domains (AI Governance Readiness, Policy Lifecycle) are the
clearest candidates for **new question themes** in a future, versioned question
bank.

---

## 3. Recommended target architecture

**Frozen deterministic core + additive Government-Readiness Layer** (per the
[architecture decision](./GOVERNMENT_READINESS_ARCHITECTURE_DECISION.md)).

```
 GOVERNMENT-READINESS LAYER (additive, non-scoring)
   Evidence(ladder) → Finding → Obligation(taxonomy) → Consequence
        │                │            │                    │
        └──── Confidence envelope (evidence-fed, per finding) ────┘
                         │
                  Recommendation (finding-aware, calm)
                         │  reads, never writes
 ─────────────────────── ▼ ───────────────────────────────────
 DETERMINISTIC SCORING CORE (FROZEN)
   5 dimensions · weights · composite · maturity bands ·
   contextual interpretation (labels only)
 ─────────────────────────────────────────────────────────────
 OBSERVATORY (opt-in, K=5, characteristic baselines, no rankings)
 AI BOUNDARY (five-layer; never scores/decides/routes/profiles)
```

---

## 4. Gap analysis → required new artifacts

### 4.1 New doctrine requirements

- Obligation taxonomy doctrine (ratify the seven classes + hierarchy).
- Consequence model doctrine (six classes + confidence-gating).
- Confidence evolution note (evidence-fed `min`-band; per-finding envelopes).
- Explainability contract (seven-answer completeness gate).
- Benchmark publication doctrine (cohort floors, safe/unsafe catalogue, honesty
  clause).
- IRR methodology doctrine (calibration set, κ/ICC thresholds).

### 4.2 New schema requirements (design only — no migrations here)

- `Finding` artifact (id, statement, contributing questions, evidence level,
  affected dimensions + contributions, obligation classes, severity, confidence
  envelope, consequence classes, recommendation refs).
- `TraceabilityRecord` with `chainIntegrity` invariants.
- `obligationTaxonomyVersion` + `consequenceModelVersion` pinning.

### 4.3 New report requirements

- Three-depth rendering (executive / governance / auditor).
- Chain-integrity attestation line.
- Per-finding seven-answer block at auditor depth.
- Honesty clause on every benchmark statement.

### 4.4 New observatory requirements

- Codified cohort minimums (N≥20, K≥5) + suppression below threshold.
- Safe/unsafe benchmark-claim catalogue enforced at the ethics gate.
- Evidence-level aggregates as a preferred benchmark primitive.

### 4.5 New validation requirements

- See Phase 12 (§6).

---

## 5. Procurement & Sharpe roadmaps (summary)

- **Procurement:** Advisory / Crown Corp / Municipal / Pilot are **Conditional-Go**
  now; Regulator is **No-Go until IRR measured.** Full sequencing in the
  [procurement assessment](./OCI_OCRA_PROCUREMENT_READINESS_ASSESSMENT.md).
- **Sharpe validation:** all eight objectives clear at `Validated` or
  `Validated-with-conditions`; ordered conditions register drives the build.
  Detail in the [validation report](./GOVERNMENT_VALIDATION_REPORT_V1.md).

---

## 6. Validation & non-regression strategy (Phase 12)

The additive layer **must not regress** the validated core. The strategy is two
tiers: existing guards (the floor) and new suites (the layer).

### 6.1 Existing guards — the non-regression floor (must keep passing)

From `worldClassComplexityValidation.test.ts` and peers:

1. **Discrimination** — distinct profiles produce distinct outputs.
2. **Monotonicity** — increasing complexity never *reduces* routed coverage; more
   evidence never *lowers* the score for the same posture.
3. **Determinism** — identical inputs → byte-identical outputs.
4. **Fairness** — identical answers score identically across the smallest and
   largest contexts (context affects interpretation only).
5. **Explainability** — every routed bank yields a stable explainability snapshot.
6. **Comparability invariant** — core questions always included; one universal
   0–100 scale.

### 6.2 New suites — the government-readiness layer

| Suite | Invariant under test |
| --- | --- |
| **Policy Traceability** | Every recommendation traces to ≥1 finding; every finding traces to evidence |
| **Obligation Mapping** | Mapping is deterministic + table-driven; obligations never alter any score |
| **Confidence Calculation** | `min`-band composition; evidence floor respected; no value can inflate confidence; per-finding envelopes deterministic |
| **Explainability Completeness** | No finding surfaces unless all seven answers populated; render is deterministic + PII-free |
| **Consequence Gating** | Consequence severity bounded by confidence; never asserted on INSUFFICIENT |
| **Benchmark Safety** | No published cut below N/K floors; no ranking/normative claim emitted |
| **Backward Compatibility** | Existing labour / healthcare / association assessments produce **identical scores** pre- and post-layer (the layer is read-only over the core) |

### 6.3 Backward-compatibility guarantee (across sectors)

Because the layer is **read-only over the frozen core**, any historical assessment
(labour, healthcare, associations, and future sectors) **must reproduce its exact
prior composite, dimensions, and maturity band.** This is the single most
important regression test: it proves the government-readiness program added
legibility **without moving a single number.**

---

## 7. Risks & tradeoffs (program-level)

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Scope creep into a government scoring overlay | High | Architecture decision forbids it; backward-compat suite enforces it |
| Reporting complexity from new layers | Medium | Three-depth explainability; executive view = one line per finding |
| Obligation catalogue maintenance (legal-adjacent) | Medium | Version + govern taxonomy; universal model, sector-scoped citations |
| Over-claiming regulator-readiness pre-IRR | High | Stage claims; No-Go for Regulator until IRR thresholds met |
| "Practitioner-informed coefficients" read as weakness | Medium | Frame as honesty; pair with calibration roadmap |
| IRR reveals lower-than-hoped agreement | Medium | Feed variance into confidence (already supported); train to threshold; disclose |
| AI boundary erosion under delivery pressure | High | Explainability model permits AI for *phrasing only*; validation forbids AI-originated answers |

---

## 8. The twelve required deliverables — index

| # | Required deliverable | Where |
| --- | --- | --- |
| 1 | Current-state architecture audit | §1 (this doc) |
| 2 | Government validation domains | §2 (this doc) |
| 3 | Government readiness assessment | [procurement assessment](./OCI_OCRA_PROCUREMENT_READINESS_ASSESSMENT.md) |
| 4 | Recommended target architecture | §3 + [architecture decision](./GOVERNMENT_READINESS_ARCHITECTURE_DECISION.md) |
| 5 | Gap analysis | §4 (this doc) + procurement assessment |
| 6 | New doctrine requirements | §4.1 + obligation/consequence/confidence docs |
| 7 | New schema requirements | §4.2 + [traceability](./OCI_OCRA_POLICY_TRACEABILITY_ARCHITECTURE.md) |
| 8 | New report requirements | §4.3 + [explainability](./OCI_OCRA_EXPLAINABILITY_MODEL.md) |
| 9 | New observatory requirements | §4.4 + [benchmark governance](./OCI_OCRA_BENCHMARK_GOVERNANCE_REVIEW.md) |
| 10 | Validation / non-regression strategy | §6 (this doc) |
| 11 | Procurement-readiness roadmap | [procurement assessment](./OCI_OCRA_PROCUREMENT_READINESS_ASSESSMENT.md) §5 |
| 12 | Richard Sharpe validation roadmap + risks/tradeoffs | [Sharpe protocol](./RICHARD_SHARPE_VALIDATION_PROTOCOL.md) + §7 (this doc) |

---

## 9. The single sentence to remember

> OCI/OCRA becomes government-grade not by changing how it scores, but by making
> every score **fully traceable to evidence, mapped to obligation, bounded by
> honest confidence, and named in the currency of institutional consequence** —
> all added as a read-only layer above a frozen, validated, universal core.

---

## 10. What must change / must not change (master table)

| Element | Verdict | Why |
| --- | --- | --- |
| Dimension/composite/maturity math | **MUST NOT CHANGE** | Validated; benchmark integrity; backward-compat |
| Fairness (context → interpretation only) | **MUST NOT CHANGE** | Core fairness guarantee |
| Anti-surveillance / AI boundary | **MUST NOT CHANGE** | Constitutive |
| Observatory K=5 / no rankings | **MUST NOT CHANGE** | Privacy + non-stigmatization |
| Evidence ladder | **SURFACE per finding** | Already exists; make first-class |
| Finding artifact | **ADD** | Unit of explanation missing |
| Obligation taxonomy | **ADD (non-scoring)** | Government language layer |
| Consequence model | **ADD (non-scoring)** | "Avoided consequences" framing |
| Confidence | **EVOLVE (evidence-fed, per-finding)** | Reuse, don't redesign |
| Benchmark publication rules | **CODIFY** | Make discipline explicit |
| IRR program | **BUILD (staged)** | Regulator gate |
