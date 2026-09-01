# OCRA World-Class Complexity Validation (2026-06-13)

> **STATUS: `premature`.** "World-class" is a banned claim (see [`OCI_METHOD.md`](../../OCI_METHOD.md)).
> This document is an internal engineering validation note, not a doctrine or marketing claim. It
> is retained for engineers only until it is retitled without the banned phrase. See
> [`SUPERSEDED.md`](../../SUPERSEDED.md).

## Scope
Validate that OCI/OCRA assessment value holds from the smallest/simplest organizations to the largest/most complex organizations before Wave C and D.

## World-Class Criteria
1. Discrimination: adaptation must differentiate organizational contexts across a complexity ladder.
2. Monotonicity: complexity classification should not regress when moving from smaller/simpler to larger/more complex declared contexts.
3. Determinism and stability: identical inputs produce identical profile/routing outputs.
4. Fairness/calibration: context should influence interpretation/routing, not alter numeric scoring for identical answers.
5. Explainability: profile outputs must carry complete rule-based rationale.

## Test Surfaces
1. Complexity/routing validation suite:
   - `apps/union-eyes/lib/icra/adaptation/__tests__/worldClassComplexityValidation.test.ts`
2. API boundary validation suite:
   - `apps/union-eyes/app/api/__tests__/oci-assessment.route.test.ts`
3. Regression suites (adaptation core):
   - `apps/union-eyes/lib/icra/adaptation/__tests__/questionRoutingEngine.test.ts`
   - `apps/union-eyes/lib/icra/adaptation/__tests__/orgContextClassifier.test.ts`
   - `apps/union-eyes/lib/icra/adaptation/__tests__/orgComplexityModel.test.ts`
4. Broader gate:
   - `corepack pnpm test:fast`

## Method
A six-rung complexity ladder was validated using declared context only:
- micro -> small -> mid-sized -> large -> enterprise -> federated-complex.

For each rung, the validation asserted:
- expected institutional scale,
- expected continuity complexity,
- no conservative-default fallback,
- deterministic routing fingerprint,
- monotonic inclusion growth for tiered adaptive questions.

Fairness was validated by scoring identical answer payloads under smallest vs largest contexts and asserting equality of:
- composite score,
- dimension scores,
- section scores.

Explainability was validated by asserting all five rationale dimensions are present:
- institutionalScale,
- continuityComplexity,
- governanceComplexity,
- continuityExposure,
- respondentLens.

## Results
PASS

Evidence summary:
1. New world-class suite: 4 passed, 0 failed.
2. New API boundary suite + world-class suite run: 6 passed, 0 failed.
3. Adaptation regression suites: 32 passed, 0 failed.
4. Broader fast gate: 1883 test files passed; 26587 tests passed; 1 skipped.

## Interpretation
The current OCI/OCRA adaptation stack demonstrates strong world-class characteristics for this scope:
1. It differentiates organizational complexity tiers without speculative inference.
2. It preserves deterministic routing behavior suitable for audit and reproducibility.
3. It avoids scale bias in numeric scoring for equivalent evidence.
4. It preserves explicit explainability at profile generation time.

## Residual Risks
1. Real-world distribution drift: synthetic ladder contexts should be complemented with production-like anonymized cohorts.
2. API wrapper depth: current boundary test proves forwarding integrity at `oci/assessment`; additional end-to-end checks can include downstream submission persistence and report generation surfaces.
3. Cross-product interactions: future Wave C/D additions may introduce new adaptive metadata requiring the same monotonic and fairness checks.

## Release Recommendation
Proceed to Wave C and D, with this validation suite treated as a required non-regression guard for adaptation/routing behavior.
