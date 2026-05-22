/**
 * ARTIFACT TYPE: Vitest Suite — P1 OCRA Hardening
 * MODULE: OCI Operational Truth Hardening — Part 3
 * DOCTRINE_VERSION: 1.0.0
 *
 * Scoring invariants: the OCRA scoring engine must be deterministic, bounded,
 * and refuse to coerce malformed input.
 */

import { describe, expect, it } from 'vitest';

import { buildUniformAnswers, buildGradedAnswers } from '../../integration/__fixtures__/ociFixtures';
import { scoreAssessment } from '../scoring';

describe('OCRA scoring invariants', () => {
  it('composite is a finite integer in [0, 100] for every uniform band', () => {
    for (const score of [0, 1, 2, 3, 4] as const) {
      const { profile } = scoreAssessment(`invariant:${score}`, buildUniformAnswers(score));
      expect(Number.isInteger(profile.composite)).toBe(true);
      expect(profile.composite).toBeGreaterThanOrEqual(0);
      expect(profile.composite).toBeLessThanOrEqual(100);
    }
  });

  it('every dimension score is bounded integer in [0, 100]', () => {
    const { profile } = scoreAssessment('invariant:dims', buildGradedAnswers((i) => (i % 5) as 0 | 1 | 2 | 3 | 4));
    for (const d of profile.dimensions) {
      expect(Number.isInteger(d.score)).toBe(true);
      expect(d.score).toBeGreaterThanOrEqual(0);
      expect(d.score).toBeLessThanOrEqual(100);
    }
  });

  it('the answeredQuestionCount matches the supplied answers length', () => {
    const answers = buildUniformAnswers(2);
    const { profile } = scoreAssessment('invariant:count', answers);
    expect(profile.answeredQuestionCount).toBe(answers.length);
  });

  it('the maturity band on the profile matches the maturity band on the trace', () => {
    const { profile, trace } = scoreAssessment('invariant:band-match', buildUniformAnswers(3));
    expect(profile.maturityBand.id).toBe(trace.maturityBand.id);
  });

  it('two runs with the same inputs produce equal dimension scores', () => {
    const a = scoreAssessment('invariant:eq-a', buildUniformAnswers(2)).profile;
    const b = scoreAssessment('invariant:eq-a', buildUniformAnswers(2)).profile;
    expect(a.dimensions).toEqual(b.dimensions);
    expect(a.sections).toEqual(b.sections);
  });
});
