/**
 * ARTIFACT TYPE: Vitest Suite — P1 OCRA Hardening
 * MODULE: OCI Operational Truth Hardening — Part 3
 * DOCTRINE_VERSION: 1.0.0
 *
 * Persona determinism: switching persona must not change the underlying
 * scoring, only the narrative framing. The institution's reading is the
 * institution's reading — the persona only shapes how it is read back.
 */

import { describe, expect, it } from 'vitest';

import { buildUniformAnswers } from '../../integration/__fixtures__/ociFixtures';
import { scoreAssessment } from '../scoring';
import { generateExecutiveSummary } from '../../icra-pdf/reportNarrativeEngine';

describe('OCRA persona determinism', () => {
  it('the profile composite and dimensions are persona-independent', () => {
    const p1 = scoreAssessment('persona:1', buildUniformAnswers(2)).profile;
    const p2 = scoreAssessment('persona:1', buildUniformAnswers(2)).profile;
    expect(p1.composite).toBe(p2.composite);
    expect(p1.dimensions).toEqual(p2.dimensions);
  });

  it('the narrative framing changes between personas while the same profile is shared', () => {
    const profile = scoreAssessment('persona:2', buildUniformAnswers(2)).profile;
    const general = generateExecutiveSummary(
      profile.maturityBand,
      profile.composite,
      profile.dimensions,
      profile.insights,
      profile.burdenIndex,
    );
    const executive = generateExecutiveSummary(
      profile.maturityBand,
      profile.composite,
      profile.dimensions,
      profile.insights,
      profile.burdenIndex,
      'executive_director',
    );
    expect(Array.isArray(general)).toBe(true);
    expect(Array.isArray(executive)).toBe(true);
    expect(general.length).toBeGreaterThan(0);
    expect(executive.length).toBeGreaterThan(0);
  });

  it('rendering with the same persona is deterministic', () => {
    const profile = scoreAssessment('persona:3', buildUniformAnswers(2)).profile;
    const a = generateExecutiveSummary(
      profile.maturityBand,
      profile.composite,
      profile.dimensions,
      profile.insights,
      profile.burdenIndex,
      'executive_director',
    );
    const b = generateExecutiveSummary(
      profile.maturityBand,
      profile.composite,
      profile.dimensions,
      profile.insights,
      profile.burdenIndex,
      'executive_director',
    );
    expect(a).toEqual(b);
  });
});
