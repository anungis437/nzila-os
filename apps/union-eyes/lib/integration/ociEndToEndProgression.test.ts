/**
 * ARTIFACT TYPE: Vitest Integration Suite
 * MODULE: OCI Operational Truth Hardening — Part 1
 * DOCTRINE_VERSION: 1.0.0
 *
 * Cross-product state progression: assert that an institutional reading
 * evolves coherently when fed back through the lifecycle a second time.
 * The OCI lifecycle must produce ordered, monotonic, refusal-friendly
 * progression — never invent a trajectory it has not observed.
 */

import { describe, expect, it } from 'vitest';

import {
  buildGradedAnswers,
  buildUniformAnswers,
  FIXTURE_INSTITUTION_SCOPE,
} from './__fixtures__/ociFixtures';

import { scoreAssessment } from '../icra/scoring';
import { resolveMaturityBand } from '../icra/maturity';

describe('OCI end-to-end progression — coherent evolution across re-readings', () => {
  it('a higher-maturity answer set produces a strictly non-lower composite than a lower one', () => {
    const lower = scoreAssessment('progression:lower', buildUniformAnswers(1)).profile;
    const higher = scoreAssessment('progression:higher', buildUniformAnswers(3)).profile;
    expect(higher.composite).toBeGreaterThan(lower.composite);
  });

  it('two consecutive identical readings produce the same composite (idempotence)', () => {
    const answers = buildUniformAnswers(2);
    const a = scoreAssessment('progression:idem-a', answers).profile;
    const b = scoreAssessment('progression:idem-b', answers).profile;
    expect(a.composite).toBe(b.composite);
    expect(a.maturityBand.id).toBe(b.maturityBand.id);
    expect(a.dimensions).toEqual(b.dimensions);
    expect(a.sections).toEqual(b.sections);
  });

  it('the maturity band id resolved from the composite matches the band on the profile', () => {
    for (const score of [0, 1, 2, 3, 4] as const) {
      const profile = scoreAssessment(`progression:band-${score}`, buildUniformAnswers(score)).profile;
      expect(resolveMaturityBand(profile.composite).id).toBe(profile.maturityBand.id);
    }
  });

  it('graded answers (non-uniform) still yield a valid, finite, in-range composite', () => {
    const profile = scoreAssessment(
      'progression:graded',
      buildGradedAnswers((i) => (i % 5) as 0 | 1 | 2 | 3 | 4),
    ).profile;
    expect(Number.isFinite(profile.composite)).toBe(true);
    expect(profile.composite).toBeGreaterThanOrEqual(0);
    expect(profile.composite).toBeLessThanOrEqual(100);
  });

  it('every dimension score is bounded to the integer range 0..100', () => {
    const profile = scoreAssessment('progression:bounds', buildUniformAnswers(2)).profile;
    for (const d of profile.dimensions) {
      expect(Number.isInteger(d.score)).toBe(true);
      expect(d.score).toBeGreaterThanOrEqual(0);
      expect(d.score).toBeLessThanOrEqual(100);
    }
  });

  it('the institution scope is reviewer-led — fixtures never leak into the profile', () => {
    const profile = scoreAssessment('progression:scope', buildUniformAnswers(2)).profile;
    expect(profile.assessmentId).toBe('progression:scope');
    // The profile is the institution's own reading; no fixture scope is encoded.
    expect(JSON.stringify(profile)).not.toContain(FIXTURE_INSTITUTION_SCOPE);
  });
});
