/**
 * ARTIFACT TYPE: Vitest Suite — Doctrine Execution Integrity
 * MODULE: OCI Operational Truth Hardening — Part 8
 * DOCTRINE_VERSION: 1.0.0
 *
 * Whatever surface composes the executive narrative, it must behave the same
 * way for the same inputs across personas, and must never invent or omit a
 * scored insight from the underlying profile.
 */

import { describe, expect, it } from 'vitest';

import { scoreAssessment } from '../icra/scoring';
import { generateExecutiveSummary } from '../icra-pdf/reportNarrativeEngine';
import { buildUniformAnswers } from './__fixtures__/ociFixtures';

describe('Doctrine execution integrity', () => {
  it('the narrative is a non-empty paragraph stream', () => {
    const profile = scoreAssessment('a1', buildUniformAnswers(2)).profile;
    const paragraphs = generateExecutiveSummary(
      profile.maturityBand,
      profile.composite,
      profile.dimensions,
      profile.insights,
      profile.burdenIndex,
    );
    expect(Array.isArray(paragraphs)).toBe(true);
    expect(paragraphs.length).toBeGreaterThan(0);
    for (const p of paragraphs) {
      expect(typeof p).toBe('string');
      expect(p.trim().length).toBeGreaterThan(0);
    }
  });

  it('the narrative is deterministic for identical inputs', () => {
    const profile = scoreAssessment('a1', buildUniformAnswers(3)).profile;
    const a = generateExecutiveSummary(
      profile.maturityBand,
      profile.composite,
      profile.dimensions,
      profile.insights,
      profile.burdenIndex,
    );
    const b = generateExecutiveSummary(
      profile.maturityBand,
      profile.composite,
      profile.dimensions,
      profile.insights,
      profile.burdenIndex,
    );
    expect(a).toEqual(b);
  });

  it('the narrative shifts when the underlying maturity band shifts', () => {
    const low = scoreAssessment('a-low', buildUniformAnswers(0)).profile;
    const high = scoreAssessment('a-high', buildUniformAnswers(4)).profile;
    const narrLow = generateExecutiveSummary(
      low.maturityBand,
      low.composite,
      low.dimensions,
      low.insights,
      low.burdenIndex,
    );
    const narrHigh = generateExecutiveSummary(
      high.maturityBand,
      high.composite,
      high.dimensions,
      high.insights,
      high.burdenIndex,
    );
    expect(narrLow).not.toEqual(narrHigh);
  });
});
