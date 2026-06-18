# OCI / OCRA Explainability Model

> **Status:** Blueprint — Architecture Review Only (no implementation)
> **Audience:** Auditors, regulators, deputy ministers, governance professionals
> **Depends on:** [traceability architecture](./OCI_OCRA_POLICY_TRACEABILITY_ARCHITECTURE.md),
> [obligation taxonomy](./OCI_OCRA_OBLIGATION_TAXONOMY.md),
> [confidence architecture](./OCI_OCRA_CONFIDENCE_ARCHITECTURE.md)

---

## 1. The explainability standard

A government-grade finding is not explainable because it has a paragraph of prose.
It is explainable when, for **every** finding, the system can answer seven
questions deterministically and identically on re-run:

1. **What evidence was observed?**
2. **What finding did it produce?**
3. **What obligation does it affect?**
4. **What dimension does it affect (and by how much)?**
5. **What is the confidence?**
6. **What is the consequence?**
7. **What is the recommended action?**

This is the **Seven-Answer Contract.** Any output that cannot complete all seven
is, by definition, not procurement-ready and must be suppressed or downgraded.

---

## 2. The Seven-Answer Contract (per finding)

```
FINDING: "Succession authority for the executive director is undocumented."

1. EVIDENCE      Evidence level: VERBAL (interview only; no delegation
                 instrument produced). reviewerCredit: oral.
2. FINDING       Deterministic assertion from Q-OPS-07 + Q-GOV-03 traces.
                 findingId: f.succession_authority_undocumented
3. OBLIGATION    Governance (Tier 4), Fiduciary (Tier 3), Continuity (Tier 6).
                 Lead framing: Fiduciary. (Statutory NOT asserted — evidence
                 below DOCUMENTED floor.)
4. DIMENSION     transition_readiness −contribution; governance_fragility
                 (risk) elevated. Exact weighted contribution from
                 questionTraces.dimensionContributions.
5. CONFIDENCE    LOW. Cautions: SMALL_SAMPLE? no; LIMITED_GOVERNANCE_EVIDENCE
                 yes (capped by VERBAL evidence band). Rationale array attached.
6. CONSEQUENCE   Institutional + Service-Delivery continuity risk on
                 unplanned departure. (see consequence model)
7. RECOMMENDATION Calm next step: document delegation of authority; optional
                 governance workshop. Non-coercive. recommendationRef:
                 rec.governance_workshop
```

Each line is a **persisted field**, not generated prose. The narrative is
*rendered from* the fields; the fields are the truth.

---

## 3. Explainability is reconstruction, not narration

| Anti-pattern (forbidden) | Required pattern |
| --- | --- |
| LLM writes a plausible explanation | Explanation is rendered from persisted trace fields |
| Confidence asserted in prose | Confidence is the `ConfidenceEnvelope` with rationale array |
| Obligation implied by tone | Obligation is an explicit taxonomy reference |
| "The score is low because…" hand-wave | Exact `dimensionContributions` shown on drill-down |
| Recommendation invents urgency | Recommendation maps deterministically from finding + band |

The existing `RoutingExplainabilitySnapshot` is the template: a **pure,
audit-safe, PII-free, JSON-persistable** record that the report renders. The
explainability model extends that template from *routing* to *findings*.

---

## 4. Three explanation depths (one model, three audiences)

The same persisted chain serves three audiences without re-computation:

### 4.1 Executive depth (deputy minister)

- One line per finding: **finding + obligation + consequence + confidence band.**
- One institution-level **chain-integrity attestation** ("every finding is
  evidence-linked and confidence-bounded").

### 4.2 Governance depth (board / audit committee)

- Finding + obligation tier + affected dimension + confidence + recommendation.
- Conflicts between obligations named explicitly.

### 4.3 Auditor depth (full reconstruction)

- The complete Seven-Answer record per finding, including `contributingQuestionIds`,
  `dimensionContributions`, evidence level, confidence rationale array, taxonomy
  version, and scoring version.
- Sufficient to **independently re-derive** the finding from the answer set.

---

## 5. Explainability invariants (carried to Phase 12 validation)

1. **Completeness:** no finding may be surfaced unless all seven answers are
   populated. (Validation: `everyFindingHasEvidence ∧ everyFindingHasConfidence ∧
   everyFindingHasObligation ∧ everyFindingHasRecommendation`.)
2. **No orphan recommendation:** every recommendation traces to ≥1 finding.
3. **Determinism:** the rendered explanation is a pure function of the persisted
   chain + locale; re-render is byte-identical.
4. **No PII:** explanations are about institutional posture, never individuals.
5. **Version-pinned:** every explanation cites `scoringVersion` +
   `obligationTaxonomyVersion` so it remains interpretable after evolution.
6. **AI-free derivation:** AI may *translate* a completed chain into fluent prose
   for readability, but may **never** originate any of the seven answers. (This
   preserves the constitutive AI boundary.)

---

## 6. Where AI is and is not allowed

| Step | AI allowed? |
| --- | --- |
| Observe/credit evidence | No (reviewer) |
| Produce finding | No (deterministic over traces) |
| Map obligation | No (taxonomy table) |
| Compute dimension contribution | No (frozen core) |
| Compute confidence | No (deterministic envelope) |
| Map consequence | No (reference model) |
| Select recommendation | No (deterministic) |
| **Phrase the rendered narrative** | **Yes, optionally** — translation only, faithful to fields, no new claims |

This is the single allowable AI surface, and it is **post-hoc presentation**, not
reasoning. It is consistent with the five-layer AI architecture.

---

## 7. Executive framing

> Explainability in OCI/OCRA is not a story we tell about a number. It is the
> guarantee that any finding can be **taken apart and rebuilt** by an independent
> auditor: this is the evidence we saw, this is the finding it forced, this is the
> obligation it threatens, this is the dimension it moved, this is how confident
> we are, this is what it could cost the institution, and this is the calm next
> step. Seven answers, every time, reproducible to the byte.
