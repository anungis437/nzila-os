/**
 * ARTIFACT TYPE: Vitest Suite — Continuity Ethics Regression
 * MODULE: OCI Operational Truth Hardening — Part 8
 * DOCTRINE_VERSION: 1.0.0
 *
 * Composite scores belong to a closed integer band [0,100]. Insights, when
 * present, must reference real dimensions on the profile, never invented ones.
 */

import { describe, expect, it } from 'vitest';

import { scoreAssessment } from '../icra/scoring';
import { buildUniformAnswers } from './__fixtures__/ociFixtures';

describe('Continuity ethics regression — scored profile shape', () => {
  it('composite is a finite integer in [0, 100]', () => {
    for (const s of [0, 1, 2, 3, 4] as const) {
      const profile = scoreAssessment(`e-${s}`, buildUniformAnswers(s)).profile;
      expect(Number.isFinite(profile.composite)).toBe(true);
      expect(Number.isInteger(profile.composite)).toBe(true);
      expect(profile.composite).toBeGreaterThanOrEqual(0);
      expect(profile.composite).toBeLessThanOrEqual(100);
    }
  });

  it('insights, when present, reference a dimension that exists on the profile', () => {
    const profile = scoreAssessment('e-mid', buildUniformAnswers(2)).profile;
    const dimensionIds = new Set(profile.dimensions.map((d) => d.id));
    for (const insight of profile.insights) {
      if ('dimensionId' in insight && typeof insight.dimensionId === 'string') {
        expect(dimensionIds.has(insight.dimensionId)).toBe(true);
      }
    }
  });

  it('answeredQuestionCount equals the number of answers passed in', () => {
    const answers = buildUniformAnswers(3);
    const profile = scoreAssessment('e-ans', answers).profile;
    expect(profile.answeredQuestionCount).toBe(answers.length);
  });
});
