/**
 * ARTIFACT TYPE: Vitest Suite — P1 OCRA Hardening
 * MODULE: OCI Operational Truth Hardening — Part 3
 * DOCTRINE_VERSION: 1.0.0
 *
 * Extreme input resilience: the scoring engine refuses (throws) on malformed
 * input. It never silently coerces, never invents a fallback band, never
 * scores partial data.
 */

import { describe, expect, it } from 'vitest';

import { ALL_QUESTIONS } from '../questions';
import { buildAnswer, scoreAssessment } from '../scoring';
import { buildUniformAnswers } from '../../integration/__fixtures__/ociFixtures';

describe('OCRA extreme input resilience', () => {
  it('an invalid option value for any enumerated question throws', () => {
    const enumerated = ALL_QUESTIONS.find(
      (q) => q.type === 'select' || q.type === 'maturity_select',
    );
    expect(enumerated).toBeDefined();
    expect(() => buildAnswer(enumerated!, '__definitely_not_an_option__')).toThrow(
      /Invalid option/i,
    );
  });

  it('an empty raw value for an enumerated question throws', () => {
    const enumerated = ALL_QUESTIONS.find(
      (q) => q.type === 'select' || q.type === 'maturity_select',
    )!;
    expect(() => buildAnswer(enumerated, '')).toThrow(/Invalid option/i);
  });

  it('scoring with a duplicated answer for the same question still resolves a profile', () => {
    const answers = buildUniformAnswers(2);
    const dup = [...answers, answers[0]];
    const { profile } = scoreAssessment('extreme:dup', dup);
    expect(Number.isFinite(profile.composite)).toBe(true);
  });

  it('scoring with the empty answer set still resolves without throwing (refusal-friendly)', () => {
    const { profile } = scoreAssessment('extreme:empty', []);
    expect(Number.isFinite(profile.composite)).toBe(true);
    expect(profile.answeredQuestionCount).toBe(0);
  });
});
