/**
 * ARTIFACT TYPE: Vitest Suite — Pilot Readiness Verification
 * MODULE: OCI Operational Truth Hardening — Part 9
 * DOCTRINE_VERSION: 1.0.0
 *
 * Before any pilot, the report-producing pipeline must complete from a clean
 * answer set without throwing, and must yield a profile that downstream
 * exports can consume.
 */

import { describe, expect, it } from 'vitest';

import { scoreAssessment } from '../icra/scoring';
import { generateExecutiveSummary } from '../icra-pdf/reportNarrativeEngine';
import { buildUniformAnswers } from './__fixtures__/ociFixtures';

describe('Pilot readiness verification', () => {
  it('a uniform-mid assessment scores end-to-end and produces a narrative', () => {
    const answers = buildUniformAnswers(2);
    const { profile, trace } = scoreAssessment('pilot-mid', answers);
    expect(profile.composite).toBeGreaterThanOrEqual(0);
    expect(profile.dimensions.length).toBeGreaterThan(0);
    expect(profile.maturityBand).toBeTruthy();
    expect(trace).toBeTruthy();

    const narrative = generateExecutiveSummary(
      profile.maturityBand,
      profile.composite,
      profile.dimensions,
      profile.insights,
      profile.burdenIndex,
    );
    expect(narrative.length).toBeGreaterThan(0);
  });

  it('scoreAssessment is deterministic for the same answers', () => {
    const answers = buildUniformAnswers(3);
    const a = scoreAssessment('pilot-d', answers).profile;
    const b = scoreAssessment('pilot-d', answers).profile;
    expect(a.composite).toBe(b.composite);
    expect(a.maturityBand.id).toBe(b.maturityBand.id);
    expect(a.dimensions).toEqual(b.dimensions);
  });

  it('the profile carries a stable questionBankVersion', () => {
    const profile = scoreAssessment('pilot-v', buildUniformAnswers(2)).profile;
    expect(profile.questionBankVersion).toBeDefined();
    expect(profile.questionBankVersion).not.toBeNull();
  });
});
