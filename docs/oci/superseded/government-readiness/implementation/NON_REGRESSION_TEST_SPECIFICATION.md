# Non-Regression Test Specification

> **Status:** Test specification — **tests before code.** This document defines the
> five non-regression invariants that must have failing/passing tests authored
> **before** any additive-layer unit is implemented.
> **Pairs with:** [ADDITIVE_LAYER_IMPLEMENTATION_PLAN.md](ADDITIVE_LAYER_IMPLEMENTATION_PLAN.md)
> **Framework:** Vitest (existing). **Fixtures:** reuse
> `apps/union-eyes/lib/icra/integration/__fixtures__/ociFixtures` and the
> complexity ladder from `worldClassComplexityValidation.test.ts`.

---

## 0. Why tests first

The entire program rests on one promise: **the number never moves.** That promise
is only credible if the regression net exists *before* the code that could break
it. Each suite below is written to **fail against a naive implementation** and pass
only when the additive-layer invariant holds.

| # | Suite | Guards |
| --- | --- | --- |
| T1 | Backward compatibility — scores unchanged | The frozen core |
| T2 | Obligation mapping never changes scores | Unit A isolation |
| T3 | Every surfaced finding has all seven answers | Unit D completeness |
| T4 | No orphan recommendations | Unit E integrity |
| T5 | Confidence cannot inflate above evidence floor | Unit C honesty |

All five must be green for the layer's Definition of Done.

---

## T1 — Backward compatibility: scores unchanged

**Invariant:** introducing the additive layer must not change any historical
assessment's composite, dimension scores, or maturity band.

**Proposed file:** `apps/union-eyes/lib/icra/__tests__/backward-compat-scores.test.ts`

```
GIVEN a frozen set of golden assessments (labour, healthcare, association,
      and a synthetic future-sector fixture), each with recorded
      { composite, dimensions[], maturityBand }
WHEN  scoreAssessment(...) is run after the additive layer is present
      (and again after deriveFindings / buildTraceabilityRecord run over it)
THEN  composite, every dimension score, and maturityBand are byte-identical
      to the recorded golden values
AND   running the additive layer produces NO mutation of the ScoringTrace inputs
```

- **Fixtures:** capture golden values from current `main` before any layer code.
- **Key assertions:** `expect(result.composite).toBe(golden.composite)`;
  deep-equal on `dimensions`; `expect(result.maturityBand).toBe(golden.band)`;
  `expect(trace).toStrictEqual(traceBefore)` (no mutation).
- **Sectors covered:** labour, healthcare, associations, future-sector — proving
  cross-sector backward compatibility.

---

## T2 — Obligation mapping never changes scores

**Invariant:** mapping a finding to obligations is reporting context only and
cannot influence any score.

**Proposed file:** `apps/union-eyes/lib/icra/obligations/__tests__/obligation-mapping-isolation.test.ts`

```
GIVEN an assessment scored to { composite, dimensions, band }
WHEN  mapFindingToObligations(theme, evidenceLevel) is invoked for every finding
THEN  re-scoring the same answers yields identical composite/dimensions/band
AND   no obligation function imports the scoring module
AND   varying obligation class / tier / reportingPriorityWeight produces
      ZERO change in any score
```

- **Static guard:** assert the obligations module's import graph excludes
  `scoring.ts` (e.g. a source-scan unit test or lint rule).
- **Property check:** for a matrix of evidence levels and themes, the score output
  is invariant.
- **Evidence-floor check:** `statutory` is absent whenever
  `evidenceLevel < DOCUMENTED`.

---

## T3 — Every surfaced finding has all seven answers

**Invariant:** no finding is emitted/surfaced unless evidence, finding statement,
obligation, dimension contribution, confidence, consequence, and ≥1 recommendation
are all present.

**Proposed file:** `apps/union-eyes/lib/icra/findings/__tests__/finding-completeness.test.ts`

```
GIVEN a ScoringTrace + evidence inputs across the complexity ladder
WHEN  deriveFindings(trace, evidence) returns findings
THEN  for EVERY finding:
        - evidenceLevel is set
        - statement is non-empty and PII-free
        - obligationClasses.length >= 1
        - affectedDimensions.length >= 1 with a numeric contribution
        - confidence envelope is present with a rationale array
        - consequence.assertion is one of asserted|potential|not_asserted
        - recommendationRefs.length >= 1
AND   a finding missing ANY of the seven is NOT returned (suppressed)
```

- **Negative case:** feed an incomplete derivation input; assert the would-be
  finding is excluded, not surfaced partial.
- **Determinism:** run twice; assert identical finding ids/order/fields.

---

## T4 — No orphan recommendations

**Invariant:** every recommendation that reaches the report maps back to ≥1
finding; every finding's `recommendationRefs` resolve to real recommendations.

**Proposed file:** `apps/union-eyes/lib/icra/traceability/__tests__/no-orphan-recommendations.test.ts`

```
GIVEN a TraceabilityRecord built from derived findings
WHEN  chainIntegrity is computed
THEN  everyRecommendationHasFinding === true
AND   every recommendationRef on every finding resolves to a known
      recommendation id (recommendationsForBand catalogue)
AND   chainIntegrity.intact === true is REQUIRED before findings may render
```

- **Negative case:** inject a recommendation with no finding; assert
  `everyRecommendationHasFinding === false` and `intact === false`.
- **Render gate:** assert the render path refuses to surface findings when
  `intact === false`.

---

## T5 — Confidence cannot inflate above evidence floor

**Invariant:** the evidence level caps confidence; no factor combination can raise
a finding's confidence above the band implied by its evidence.

**Proposed file:** `apps/union-eyes/lib/icra/confidence/__tests__/confidence-evidence-floor.test.ts`

```
GIVEN evidence level L mapped to band B_evidence = evidenceBandFor(L)
WHEN  buildFindingConfidence runs with ANY combination of
      { corroborated, reviewerVariance, assessmentAgeDays }
THEN  final confidence band <= B_evidence    (min-band composition holds)
AND   VERBAL evidence can never yield HIGH or MODERATE
AND   NONE evidence yields INSUFFICIENT
AND   a strong sample/completeness signal CANNOT override weak evidence
AND   no numeric probability/percentage is ever emitted
```

- **Property sweep:** cross-product of evidence levels × variance × age × decay;
  assert the ordering `final <= evidenceBand` universally.
- **Anti-inflation case:** high sample + high completeness + VERBAL evidence →
  still `LOW`.
- **Rationale present:** assert `envelope.rationale` is a non-empty array.

---

## 6. Cross-cutting assertions (apply to all suites)

1. **Purity:** no test requires network/disk; all units are pure functions.
2. **Determinism:** every suite includes a "run twice, identical output" assertion.
3. **No PII:** snapshot assertions confirm statements/records contain no personal
   identifiers.
4. **Version pinning:** records expose `scoringVersion` +
   `obligationTaxonomyVersion` + `consequenceModelVersion`.
5. **Existing guards remain green:** the additive suites run **alongside**, not
   instead of, the existing determinism/fairness/monotonicity/discrimination/
   explainability suites in `worldClassComplexityValidation.test.ts`.

---

## 7. Authoring order

```
 1. Capture golden scores (T1 fixtures) from current main      ← do first, before any layer code
 2. Write T1 (backward compat)  ─ fails until layer is read-only
 3. Write T5 (confidence floor) ─ drives Unit C
 4. Write T2 (obligation isolation) ─ drives Unit A
 5. Write T3 (finding completeness) ─ drives Unit D
 6. Write T4 (no orphan recs) ─ drives Unit E
 7. Implement units A→E to green, re-running existing suites each step
```

---

## 8. Acceptance

The additive layer is accepted only when:

- T1–T5 are green **and** every pre-existing OCI/OCRA suite remains green.
- The backward-compat golden set covers ≥4 sectors with zero score drift.
- A reviewer confirms no existing module's scoring math was modified (diff review
  limited to additive read paths).
