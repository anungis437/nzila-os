# OCI / OCRA Policy Traceability Architecture

> **Status:** Blueprint — Architecture Review Only (no implementation)
> **Audience:** Auditors, regulators, governance professionals, procurement evaluators
> **Decision context:** assumes the frozen-core + additive-layer decision in
> [GOVERNMENT_READINESS_ARCHITECTURE_DECISION.md](./GOVERNMENT_READINESS_ARCHITECTURE_DECISION.md)

---

## 1. Why traceability is the procurement linchpin

Public-sector scrutiny is not "is the number right?" — it is **"can you
reconstruct how you got here, and would an independent reviewer get there too?"**
An assessment designed for public-sector scrutiny must answer, for *any*
finding:

1. What evidence was observed?
2. What finding did that evidence produce?
3. What obligation does the finding implicate?
4. What dimension does it affect, and by how much?
5. What is the confidence in this chain?
6. What consequence is at stake?
7. What is the recommended action?

This document specifies the **traceability chain** that makes those seven
answers reconstructable for every output.

---

## 2. The canonical traceability chain

```
 Evidence ──▶ Finding ──▶ Obligation ──▶ Dimension ──▶ Outcome (Score/Band)
     │           │            │              │                │
     └───────────┴── Confidence envelope ────┴──────────────▶ Recommendation
```

Each arrow is a **deterministic, recorded relationship**, never an inference made
at render time. The chain is **append-only** and **persistable as JSON** on the
assessment record (mirroring the existing `RoutingExplainabilitySnapshot` and
`ScoringTrace` patterns).

---

## 3. Layer-by-layer specification

### 3.1 Evidence layer

- **Source of truth:** the six-level ladder in
  `lib/icra/evidence-strength/evidenceTaxonomy.ts`
  (`NONE → VERBAL → DOCUMENTED → OPERATIONAL → VERIFIED → CROSS_VALIDATED`).
- **What it records:** for each material claim, the highest evidence level the
  reviewer could credit, plus the `reviewerCredit` class and `runtimeReliance`
  flag.
- **Government property:** distinguishes *declared* continuity from *evidenced*
  continuity — the single distinction auditors care about most.
- **Status:** EXISTS. Needs to be **surfaced per finding**, not only consumed
  internally by the branching engine.

### 3.2 Finding layer (NEW)

- **Definition:** a Finding is a deterministic, human-readable assertion derived
  from one or more answers + their evidence levels, e.g. *"Succession authority
  for the executive director is undocumented (evidence: VERBAL)."*
- **Properties:** stable `findingId`, the contributing `questionId`s, the
  evidence level, the affected dimension(s), severity, and a confidence envelope.
- **Why new:** today the pipeline goes Answer → Score → band-based Recommendation
  (`recommendationsForBand()`); there is no explicit, addressable Finding object
  to which an auditor can anchor. The Finding is the **unit of explanation**.
- **Determinism requirement:** Findings are produced by pure functions over the
  scoring trace; identical inputs yield identical findings.

### 3.3 Obligation layer (NEW)

- **Source of truth:** the Obligation Taxonomy
  ([OCI_OCRA_OBLIGATION_TAXONOMY.md](./OCI_OCRA_OBLIGATION_TAXONOMY.md)).
- **What it records:** which obligation class(es) a finding implicates
  (Statutory / Regulatory / Policy / Governance / Fiduciary / Continuity /
  Operational).
- **Critical constraint:** obligations are **reference data and reporting
  context — never a score input.** Mapping a finding to "Statutory" does not
  change any number; it changes *how the finding is reported and prioritized*.
- **Why:** government leaders think in obligations, not in 0–100 scores. The
  obligation layer translates continuity findings into the language of
  accountability.

### 3.4 Dimension layer

- **Source of truth:** `lib/icra/scoring.ts` (`dimensionTraces`).
- **What it records:** which of the five dimensions the finding contributes to,
  and the exact weighted contribution (already captured in `questionTraces` →
  `dimensionContributions`).
- **Status:** EXISTS and is fully deterministic. The traceability layer **reads**
  it; it does not modify it.

### 3.5 Outcome layer

- **Source of truth:** composite (= `institutional_continuity` score) and
  maturity band (`resolveMaturityBand()`).
- **What it records:** the contribution of the finding's dimension to the
  composite and band, plus the **contextual interpretation label**
  (`contextualScoreNormalizer`, which never alters the number).
- **Status:** EXISTS, FROZEN.

### 3.6 Recommendation layer

- **Today:** deterministic by maturity band (`recommendationsForBand()`).
- **Target:** recommendations become **finding-aware** — anchored to the
  highest-severity, highest-obligation findings — while remaining deterministic
  and non-coercive (the existing calm, sovereignty-preserving tone is preserved).
- **Constraint:** recommendations never invent urgency; they map findings →
  obligations → calm next steps.

---

## 4. Traceability record (conceptual schema)

> Reference data shape only — **no migration, no code is proposed here.**

```
TraceabilityRecord {
  assessmentId
  scoringVersion           // ties to existing ScoringTrace
  obligationTaxonomyVersion
  findings: Finding[] {
    findingId
    statement                  // plain-language, no PII
    contributingQuestionIds[]
    evidenceLevel              // from evidenceTaxonomy
    affectedDimensions[]       // with recorded contribution
    obligationClasses[]        // from obligation taxonomy
    severity
    confidence: ConfidenceEnvelope   // from @nzila/oci-confidence
    consequenceClasses[]       // from consequence model
    recommendationRefs[]
  }
  chainIntegrity {
    everyFindingHasEvidence: boolean
    everyFindingHasConfidence: boolean
    everyRecommendationHasFinding: boolean
  }
}
```

The `chainIntegrity` block is what an auditor inspects to confirm **no orphan
findings** (findings without evidence) and **no orphan recommendations**
(recommendations without findings). These become Phase-12 validation invariants.

---

## 5. Determinism & audit guarantees the chain must preserve

1. **Reproducibility:** re-running the chain over the same answers + same
   versions yields byte-identical findings, obligations, and recommendations.
2. **No render-time inference:** the report renders a *persisted* chain; it never
   computes relationships at display time.
3. **No PII in the chain:** consistent with `RoutingExplainabilitySnapshot`'s
   strict no-PII rule — statements are about institutional posture, not people.
4. **Version pinning:** the chain records `scoringVersion`,
   `questionBankVersion`, and `obligationTaxonomyVersion` so historical
   assessments remain interpretable after the taxonomy evolves.
5. **Read-only over the core:** the traceability layer may read scores, traces,
   and interpretation labels; it may **never** write them.

---

## 6. What changes, what does not

| Element | Change? | Why |
| --- | --- | --- |
| Evidence ladder | Surface per finding | Already exists internally |
| Finding artifact | **Add** | Unit of explanation is missing |
| Obligation mapping | **Add** (non-scoring) | Government language layer |
| Dimension math | **No change** | Frozen, validated |
| Composite / band | **No change** | Frozen, validated |
| Contextual interpretation | **No change** | Already fairness-correct |
| Recommendations | Make finding-aware | Preserve calm/non-coercive tone |
| Confidence envelope | Re-use per finding | Already exists |

---

## 7. Open questions for validation (carried to Sharpe protocol)

- Should a Finding be allowed to implicate **multiple** obligation classes
  simultaneously, and if so, how is reporting priority resolved? (See obligation
  conflict rules.)
- What is the minimum evidence level at which a Finding may drive a **Statutory**
  obligation flag without over-claiming? (Proposed floor: `DOCUMENTED`.)
- How is chain integrity surfaced to a non-technical deputy minister without
  drowning them in trace detail? (Proposed: a one-line integrity attestation +
  drill-down.)
