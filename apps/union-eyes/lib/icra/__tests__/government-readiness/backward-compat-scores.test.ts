/**
 * ARTIFACT TYPE: Vitest Suite — Government-Readiness Non-Regression (T1)
 * MODULE: Backward compatibility — scores unchanged
 * SPEC: docs/oci/superseded/government-readiness/implementation/NON_REGRESSION_TEST_SPECIFICATION.md §T1
 *
 * The additive layer must not change any assessment's composite, dimension
 * scores, or maturity band — and must never mutate the ScoringTrace it reads.
 */

import { describe, expect, it } from 'vitest';

import { buildGradedAnswers, buildUniformAnswers } from '../../../integration/__fixtures__/ociFixtures';
import { scoreAssessment } from '../../scoring';
import { deriveFindings, type EvidenceInputs } from '../../findings/findingDerivation';
import { buildTraceabilityRecord } from '../../traceability/traceabilityRecord';

const EVIDENCE: EvidenceInputs = {
  evidenceByTheme: {
    undocumented_succession_authority: 'DOCUMENTED',
    single_point_operational_dependency: 'VERBAL',
    board_oversight_gap: 'DOCUMENTED',
    institutional_memory_concentration: 'VERBAL',
    no_continuity_plan: 'DOCUMENTED',
    records_retention_gap: 'OPERATIONAL',
    missing_delegation_instrument: 'DOCUMENTED',
  },
  assessmentAgeDays: 30,
};

/** Sectors approximated by distinct deterministic answer postures. */
const GOLDEN_CASES = [
  { id: 'labour', answers: buildUniformAnswers(2) },
  { id: 'healthcare', answers: buildGradedAnswers((i) => (i % 5) as 0 | 1 | 2 | 3 | 4) },
  { id: 'association', answers: buildUniformAnswers(1) },
  { id: 'future-sector', answers: buildGradedAnswers((i) => ((i * 2) % 5) as 0 | 1 | 2 | 3 | 4) },
] as const;

describe('T1 — backward compatibility: scores unchanged', () => {
  for (const testCase of GOLDEN_CASES) {
    it(`preserves composite/dimensions/band for ${testCase.id} after the additive layer`, () => {
      // Golden: score once, capture canonical outputs.
      const golden = scoreAssessment(`golden:${testCase.id}`, testCase.answers);
      const goldenComposite = golden.profile.composite;
      const goldenBand = golden.profile.maturityBand.id;
      const goldenDimensions = JSON.parse(JSON.stringify(golden.profile.dimensions));

      // Deep-clone the trace before running the additive layer over it.
      const traceBefore = JSON.parse(JSON.stringify(golden.trace));

      // Run the additive layer (reads the trace).
      const findings = deriveFindings(golden.trace, EVIDENCE);
      buildTraceabilityRecord(`golden:${testCase.id}`, golden.trace, findings);

      // The additive layer must NOT mutate the trace.
      expect(golden.trace).toStrictEqual(traceBefore);

      // Re-score from the same answers; outputs must be byte-identical.
      const rescored = scoreAssessment(`golden:${testCase.id}`, testCase.answers);
      expect(rescored.profile.composite).toBe(goldenComposite);
      expect(rescored.profile.maturityBand.id).toBe(goldenBand);
      expect(rescored.profile.dimensions).toStrictEqual(goldenDimensions);
    });
  }

  it('running the additive layer twice yields identical findings (determinism)', () => {
    const { trace } = scoreAssessment('determinism', buildUniformAnswers(1));
    const a = deriveFindings(trace, EVIDENCE);
    const b = deriveFindings(trace, EVIDENCE);
    expect(a).toStrictEqual(b);
  });
});
