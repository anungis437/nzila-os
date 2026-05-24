/**
 * ARTIFACT TYPE: Vitest Suite — P1 OCRA Hardening
 * MODULE: OCI Operational Truth Hardening — Part 3
 * DOCTRINE_VERSION: 1.0.0
 *
 * Narrative consistency: the executive summary derived from a given profile
 * must be deterministic, calm in tone, and never invent recommendations.
 */

import { describe, expect, it } from 'vitest';

import { buildUniformAnswers } from '../../integration/__fixtures__/ociFixtures';
import { scoreAssessment } from '../scoring';
import { generateExecutiveSummary } from '../../icra-pdf/reportNarrativeEngine';

/**
 * Reviewer-led tone: we refuse the prescriptive vocabulary that institutional
 * intelligence should never adopt.
 */
const FORBIDDEN_TONE = /\b(optimize|disrupt|automate|seamless|leverage|synergy|empower|revolutioniz(e|ing))\b/i;

describe('OCRA narrative consistency', () => {
  it('the executive summary is deterministic for a given profile', () => {
    const a = scoreAssessment('narr:1', buildUniformAnswers(2)).profile;
    const b = scoreAssessment('narr:1', buildUniformAnswers(2)).profile;
    const na = generateExecutiveSummary(a.maturityBand, a.composite, a.dimensions, a.insights, a.burdenIndex);
    const nb = generateExecutiveSummary(b.maturityBand, b.composite, b.dimensions, b.insights, b.burdenIndex);
    expect(na).toEqual(nb);
  });

  it('the executive summary returns a non-empty list of paragraphs', () => {
    const p = scoreAssessment('narr:2', buildUniformAnswers(2)).profile;
    const paragraphs = generateExecutiveSummary(p.maturityBand, p.composite, p.dimensions, p.insights, p.burdenIndex);
    expect(paragraphs.length).toBeGreaterThan(0);
    for (const par of paragraphs) {
      expect(par.trim().length).toBeGreaterThan(0);
    }
  });

  it('the executive summary avoids prescriptive product-marketing vocabulary', () => {
    for (const band of [0, 2, 4] as const) {
      const p = scoreAssessment(`narr:tone:${band}`, buildUniformAnswers(band)).profile;
      const paragraphs = generateExecutiveSummary(
        p.maturityBand,
        p.composite,
        p.dimensions,
        p.insights,
        p.burdenIndex,
      );
      for (const par of paragraphs) {
        expect(par).not.toMatch(FORBIDDEN_TONE);
      }
    }
  });
});
