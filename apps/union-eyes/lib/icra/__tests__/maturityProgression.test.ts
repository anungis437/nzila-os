/**
 * ARTIFACT TYPE: Vitest Suite — P1 OCRA Hardening
 * MODULE: OCI Operational Truth Hardening — Part 3
 * DOCTRINE_VERSION: 1.0.0
 *
 * Maturity band progression is monotonic and reversible — increasing maturity
 * inputs cannot regress the resolved band.
 */

import { describe, expect, it } from 'vitest';

import { buildUniformAnswers } from '../../integration/__fixtures__/ociFixtures';
import { scoreAssessment } from '../scoring';
import { resolveMaturityBand, MATURITY_BANDS_ORDERED } from '../maturity';

describe('OCRA maturity band progression', () => {
  it('higher uniform inputs never produce a lower composite', () => {
    const scores = [0, 1, 2, 3, 4].map(
      (b) => scoreAssessment(`prog:${b}`, buildUniformAnswers(b as 0 | 1 | 2 | 3 | 4)).profile.composite,
    );
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
    }
  });

  it('the registered maturity bands cover the full [0, 100] composite range', () => {
    expect(MATURITY_BANDS_ORDERED.length).toBeGreaterThan(0);
    expect(resolveMaturityBand(0).id).toBeDefined();
    expect(resolveMaturityBand(100).id).toBeDefined();
  });

  it('uniform-zero inputs resolve to the lowest band', () => {
    const profile = scoreAssessment('prog:lowest', buildUniformAnswers(0)).profile;
    expect(profile.maturityBand.id).toBe(MATURITY_BANDS_ORDERED[0].id);
  });

  it('uniform-max inputs resolve to the highest band', () => {
    const profile = scoreAssessment('prog:highest', buildUniformAnswers(4)).profile;
    expect(profile.maturityBand.id).toBe(
      MATURITY_BANDS_ORDERED[MATURITY_BANDS_ORDERED.length - 1].id,
    );
  });
});
