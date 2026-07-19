# Government Readiness Architecture Decision

> **Status:** Blueprint — Architecture Review Only (no implementation)
> **Audience:** Senior public-sector executives, deputy ministers, regulators, crown corporation leadership, governance professionals, auditors
> **Scope:** OCI / OCRA assessment ecosystem
> **Decision class:** Architecture-level (constitutive)
> **Companion documents:** see [README](./README.md)

---

## 0. Purpose

This document answers a single question:

> What is the **minimum architecture change** required for OCI/OCRA to become
> defensible, explainable, auditable, benchmarkable, and procurement-ready in a
> public-sector context — **without** making OCI/OCRA "government-specific" and
> **without** disturbing its validated universality, fairness, determinism, and
> benchmark integrity?

It is a decision record. It states the options considered, the tradeoffs, the
recommended architecture, the rejected alternatives, and the rationale.

It deliberately **challenges the assumption** that a Government Context Overlay
is the correct solution.

---

## 1. What already exists (current-state, verified)

The recommendation below is grounded in the **actual** architecture, not an
idealized one. The following are verified facts about the shipped system.

### 1.1 Deterministic scoring core

- Five dimensions: `institutional_continuity`, `governance_fragility`,
  `trust_debt`, `operational_memory`, `transition_readiness`
  (`lib/icra/types.ts`).
- `governance_fragility` and `trust_debt` are **risk dimensions**, inverted
  (`final = (1 − raw) × 100`) before composition so all dimensions are
  continuity-positive (`lib/icra/scoring.ts`).
- Each dimension score = `Σ(effectiveScore × weight) / Σ(weight)`, ×100, rounded.
- **Composite = the `institutional_continuity` dimension score.** Maturity band
  is resolved from composite via `resolveMaturityBand()` (`lib/icra/maturity.ts`,
  five bands).
- Every number is traceable to a question answer and a published weight via
  `ScoringTrace` (`questionTraces`, `dimensionTraces`).

### 1.2 Fairness is already structural

- `contextualScoreNormalizer` (`lib/icra/adaptation/contextualScoreNormalizer.ts`)
  produces a **`NormalizedInterpretation`** (severity label + statement) and
  **never alters the numeric composite.** Mission-critical exposure raises the
  *interpretive* bar, not the *number*.
- This is the single most important government-readiness asset the system
  already owns: **context changes interpretation, never score.**

### 1.3 Adaptation preserves comparability

- The routing engine (`questionRoutingEngine.ts`) reads **only declared org
  context** (type, sector, size, age, role, governance model, federation).
- **Core questions are always included** (`corePreserved` in
  `routingExplainabilitySnapshot.ts`); minimum routed count 18.
- Identical answer payloads score identically across the smallest and largest
  contexts (validated by `worldClassComplexityValidation.test.ts`).

### 1.4 Confidence is already formalized

- `@nzila/oci-confidence` provides the **Universal Confidence Envelope**
  (`confidence`, `sampleSize`, `dataCompleteness`, `stability`, `decay`,
  `cautionState`). It composes sample band, completeness band, stability,
  temporal decay, reviewer variance, and governance-evidence presence by taking
  the **lower** band. No probability claims.

### 1.5 Evidence is already laddered

- `lib/icra/evidence-strength/evidenceTaxonomy.ts` defines a **six-level
  evidence ladder**: `NONE → VERBAL → DOCUMENTED → OPERATIONAL → VERIFIED →
  CROSS_VALIDATED`, each with a `reviewerCredit` class and a `runtimeReliance`
  boolean.

### 1.6 Observatory / benchmark governance is already constrained

- Sector baselines are **characteristic, not normative** (`lib/oci/benchmark/`).
- Aggregate intelligence is **opt-in, k-anonymous (K=5)**, refusal-first
  (`OCI_INTELLIGENCE_ETHICS.md`). No rankings, ever.

### 1.7 AI boundary is constitutive

- Five-layer architecture (`OCRA_AI_SYSTEM_ARCHITECTURE.md`): AI never
  calculates scores, never determines maturity, never routes, never profiles.

### 1.8 What does NOT exist

- **No formal obligation model.** There is no canonical encoding of statutory /
  regulatory / policy / governance / fiduciary / continuity / operational
  obligation classes, and no mapping from findings to obligations.
- **No explicit Finding layer** between Score and Recommendation. Recommendations
  are currently resolved **deterministically by maturity band**
  (`recommendationsForBand()` in `lib/icra/recommendations.ts`), not by an
  evidence→finding→obligation chain.
- **No consequence model** connecting findings to institutional/governance/
  operational/service-delivery/public-trust/financial risk.
- **No inter-rater reliability (IRR) instrumentation** beyond a reviewer-variance
  *input* to the confidence model.

This gap inventory is what the government-readiness program must close — and the
list is short precisely because the deterministic, fairness-preserving spine is
already strong.

---

## 2. The five challenge questions

The brief requires these be answered **before** any design is proposed.

### Q1 — Do existing OCI/OCRA dimensions already capture the required public-sector signals?

**Largely yes, at the dimension level.** Public-sector continuity risk is
governance memory, decision traceability, succession survivability, and
reconstruction burden — all of which already map onto the five dimensions and
the signature frameworks (SDI, GES, CBM, CSM, RBI). Government does not introduce
a **new continuity physics**; it introduces a **higher evidentiary and
traceability bar** on the same physics.

**What is missing is not dimensions — it is the connective tissue:** the formal
chain from evidence to obligation to consequence, and the confidence/IRR
discipline that lets an auditor *trust* the chain. Government buyers do not need
a "government dimension"; they need to reconstruct *why* a finding holds and
*what* obligation it implicates.

### Q2 — Would stronger evidence mapping solve most gaps without creating a sector overlay?

**Yes — this is the central finding.** The six-level evidence ladder already
exists but is not yet surfaced as a first-class, per-finding artifact, and is not
yet linked to obligations. Strengthening evidence mapping (Evidence → Finding →
Obligation → Dimension → Consequence → Recommendation) closes the majority of
the procurement gap **without touching scoring math** and **without sector
forking**.

### Q3 — Would a government overlay introduce benchmark fragmentation?

**Yes, and this is decisive.** A "government scoring overlay" would create a
second numeric basis. Benchmarks would fork into "general" and "government"
cohorts that are no longer comparable, violating the comparability invariant
(identical 0–100 scale across all institutions) that the observatory depends on.
Sector *baselines* (characteristic ranges) already provide sector context
**without** forking the score. An overlay would convert a strength into a
liability.

### Q4 — Would separate overlays create future maintenance and calibration risks?

**Yes.** Every overlay is a parallel calibration surface. Each new sector overlay
multiplies the validation matrix (determinism × fairness × monotonicity ×
backward-compat must be re-proven per overlay), multiplies coefficient-registry
maintenance, and creates drift risk between overlays. The system already resists
this by keeping context in **interpretation**, not **numerics**. Overlays would
reverse that discipline.

### Q5 — What is the minimum architecture change necessary to achieve government-grade credibility?

**A traceability and evidence-governance layer that sits *above* the unchanged
scoring core** — not a new scoring path. Concretely:

1. A formal **Obligation Taxonomy** (reference data, not score input).
2. An explicit **Finding** artifact and an **Evidence → Finding → Obligation →
   Dimension → Consequence → Recommendation** chain.
3. A surfaced, per-finding **Confidence** envelope (already computable).
4. A **Consequence model** (finding category → risk classes).
5. An **IRR architecture** (anticipatory; measurable later).
6. **Benchmark-claim governance** (safe vs unsafe claims made explicit).

None of these alter dimension math, composite math, or maturity-band logic.

---

## 3. Options considered

### Option A — Government Context Overlay (sector-specific scoring/dimensions)

Add government-specific dimensions or a government scoring adjustment layer.

- **Pros:** superficially "tailored"; easy to demo to a single buyer.
- **Cons:** benchmark fragmentation (Q3); calibration/maintenance multiplication
  (Q4); breaks the comparability invariant; reverses the "context → interpretation,
  not score" discipline; requires re-proving determinism/fairness/monotonicity per
  overlay; invites the accusation that scores are sector-gamed.
- **Verdict:** **Rejected.** Highest risk, lowest architectural integrity.

### Option B — Evidence & Traceability Layer above an unchanged core (RECOMMENDED)

Keep the scoring core **frozen**. Add a non-scoring layer that makes every
finding evidence-linked, obligation-mapped, confidence-bounded, and
consequence-aware.

- **Pros:** preserves universality, fairness, determinism, monotonicity, and
  benchmark integrity by construction (the number never moves); directly answers
  what auditors and procurement actually ask ("show me why"); reuses existing
  assets (evidence ladder, confidence envelope, explainability snapshot); no
  sector fork; one calibration surface.
- **Cons:** requires disciplined new doctrine + schema + reporting; does not
  produce a flashy "government score"; value is in defensibility, not novelty.
- **Verdict:** **Recommended.**

### Option C — Documentation-only positioning (crosswalks + procurement FAQ, no architecture change)

Rely solely on existing ISO/COBIT crosswalks and the procurement FAQ.

- **Pros:** zero engineering cost.
- **Cons:** does not close the *structural* gaps (no obligation layer, no finding
  artifact, no per-finding confidence surface, no IRR). Auditors will find the
  seams. Positioning without traceability is not procurement-ready.
- **Verdict:** **Rejected as insufficient** (necessary but not sufficient; the
  crosswalks remain valuable *inside* Option B).

### Option D — External certification dependency (defer to ISO 22301 / third-party audit)

Position OCI/OCRA purely as an input to an external certified process.

- **Pros:** offloads validation burden.
- **Cons:** abandons the differentiated claim (human-continuity fabric that BCMS
  implicitly depends on); makes OCI/OCRA a commodity feeder; does not improve
  OCI/OCRA's own auditability.
- **Verdict:** **Rejected** (the crosswalks already provide complementarity;
  full dependency surrenders the category).

---

## 4. Recommended architecture

**Adopt Option B: an Evidence & Traceability Layer above a frozen scoring core.**

```
            ┌─────────────────────────────────────────────────────────┐
            │   GOVERNMENT-READINESS LAYER  (new, non-scoring)         │
            │                                                          │
   Evidence │  Evidence ──▶ Finding ──▶ Obligation ──▶ Consequence    │
   ladder   │     │            │            │              │          │
   (exists) │     └── Confidence envelope (exists) ────────┘          │
            │                  │                                       │
            │            Recommendation (now finding-driven)          │
            └───────────────────────┬──────────────────────────────── ┘
                                    │  reads (never writes) scores/bands
            ┌───────────────────────▼─────────────────────────────────┐
            │   DETERMINISTIC SCORING CORE  (FROZEN — do not alter)    │
            │   dimensions · weights · composite · maturity bands      │
            │   contextual interpretation (labels only, no numerics)   │
            └──────────────────────────────────────────────────────────┘
```

### 4.1 What MUST NOT change (non-negotiable freeze)

- Dimension math, composite math, maturity-band logic.
- The five dimensions and their risk-inversion semantics.
- The comparability invariant (identical 0–100 scale across all institutions).
- The fairness rule (context alters interpretation, never numerics).
- The anti-surveillance and AI boundaries.

### 4.2 What is added (all non-scoring)

| Addition | Nature | Touches score? |
| --- | --- | --- |
| Obligation Taxonomy | reference data | No |
| Finding artifact | derived, deterministic | No |
| Evidence→…→Recommendation chain | composition over existing outputs | No |
| Per-finding Confidence surface | re-use of existing envelope | No |
| Consequence model | reference mapping | No |
| IRR architecture | measurement discipline | No |
| Benchmark-claim governance | publication rules | No |

### 4.3 Why this is minimal

Every government-grade property (defensible, explainable, auditable,
benchmarkable, procurement-ready) is achieved by **making the existing
deterministic outputs legible and obligation-aware** — not by adding a second
way to compute a number. The number is the one thing public-sector scrutiny
attacks hardest; freezing it is the strongest possible posture.

---

## 5. Rejected alternatives — consolidated rationale

| Rejected | Core reason |
| --- | --- |
| Government scoring overlay (A) | Benchmark fragmentation + calibration multiplication; breaks comparability invariant |
| Documentation-only (C) | Leaves structural traceability gaps; auditors find the seams |
| External certification dependency (D) | Surrenders the differentiated category; does not improve OCI/OCRA's own auditability |
| New government dimensions | Public-sector continuity is the same physics at a higher evidentiary bar, not a new dimension |
| Per-sector confidence formulas | One confidence methodology must hold across sectors or benchmarks fork |

---

## 6. Consequences of this decision

- The downstream blueprints (policy traceability, obligation taxonomy,
  confidence, explainability, consequence, benchmark governance, IRR,
  procurement, Sharpe validation) all assume **a frozen core and an additive
  layer.** None propose scoring changes.
- The validation strategy (Phase 12) gains new suites (traceability, obligation
  mapping, confidence determinism, explainability completeness) **in addition to**
  the existing determinism/fairness/monotonicity guards, which remain the
  non-regression floor.
- Procurement readiness becomes a function of **traceability completeness and
  evidence governance**, both of which are measurable and demonstrable.

---

## 7. One-paragraph executive statement

> OCI/OCRA does not need to become a government product. It needs to make its
> already-deterministic, already-fair findings **fully traceable** — from the
> evidence observed, to the finding reached, to the governance obligation
> implicated, to the institutional consequence at stake, to the recommended
> action — each step carrying an explicit confidence envelope. We achieve this by
> adding a non-scoring evidence-and-traceability layer above a frozen scoring
> core. This preserves universality, fairness, determinism, and benchmark
> integrity by construction, while giving deputy ministers, regulators, and
> auditors exactly what they require: a reconstructable line of reasoning behind
> every institutional finding.
