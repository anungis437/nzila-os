/**
 * ARTIFACT TYPE: Vitest Suite — Multi-Session Continuity
 * MODULE: OCI Operational Truth Hardening — Part 9
 * DOCTRINE_VERSION: 1.0.0
 *
 * Independent assessment "sessions" (different assessmentIds) for the same
 * answer shape must yield the same composite and band. The assessmentId is a
 * label, not a determinant.
 */

import { describe, expect, it } from 'vitest';

import { scoreAssessment } from '../icra/scoring';
import { buildUniformAnswers } from './__fixtures__/ociFixtures';

describe('Multi-session continuity integrity', () => {
  it('two sessions with identical answers reach the same composite and band', () => {
    const answers = buildUniformAnswers(2);
    const s1 = scoreAssessment('session-a', answers).profile;
    const s2 = scoreAssessment('session-b', answers).profile;
    expect(s1.composite).toBe(s2.composite);
    expect(s1.maturityBand.id).toBe(s2.maturityBand.id);
  });

  it('a session carries its own assessmentId on the profile', () => {
    const profile = scoreAssessment('session-x', buildUniformAnswers(2)).profile;
    expect(profile.assessmentId).toBe('session-x');
  });

  it('three independent sessions at increasing maturity produce monotonically non-decreasing composites', () => {
    const c0 = scoreAssessment('s0', buildUniformAnswers(0)).profile.composite;
    const c2 = scoreAssessment('s2', buildUniformAnswers(2)).profile.composite;
    const c4 = scoreAssessment('s4', buildUniformAnswers(4)).profile.composite;
    expect(c0).toBeLessThanOrEqual(c2);
    expect(c2).toBeLessThanOrEqual(c4);
  });
});
