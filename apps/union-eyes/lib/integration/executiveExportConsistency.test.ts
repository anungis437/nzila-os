/**
 * ARTIFACT TYPE: Vitest Suite — Executive Export Consistency
 * MODULE: OCI Operational Truth Hardening — Part 9
 * DOCTRINE_VERSION: 1.0.0
 *
 * The executive narrative is a stable artifact under serialization: the same
 * profile rendered to JSON and back yields the same narrative. This guards
 * the export pipeline against silent string-formatter drift.
 */

import { describe, expect, it } from 'vitest';

import { scoreAssessment } from '../icra/scoring';
import { generateExecutiveSummary } from '../icra-pdf/reportNarrativeEngine';
import { buildUniformAnswers } from './__fixtures__/ociFixtures';

describe('Executive export consistency', () => {
  it('narrative survives JSON round-trip of the profile inputs', () => {
    const profile = scoreAssessment('exp-1', buildUniformAnswers(2)).profile;
    const direct = generateExecutiveSummary(
      profile.maturityBand,
      profile.composite,
      profile.dimensions,
      profile.insights,
      profile.burdenIndex,
    );
    const cloned = JSON.parse(JSON.stringify({
      maturityBand: profile.maturityBand,
      composite: profile.composite,
      dimensions: profile.dimensions,
      insights: profile.insights,
      burdenIndex: profile.burdenIndex,
    }));
    const replayed = generateExecutiveSummary(
      cloned.maturityBand,
      cloned.composite,
      cloned.dimensions,
      cloned.insights,
      cloned.burdenIndex,
    );
    expect(replayed).toEqual(direct);
  });

  it('narrative output for distinct profiles is structurally distinct', () => {
    const low = scoreAssessment('exp-low', buildUniformAnswers(0)).profile;
    const high = scoreAssessment('exp-high', buildUniformAnswers(4)).profile;
    const a = generateExecutiveSummary(low.maturityBand, low.composite, low.dimensions, low.insights, low.burdenIndex);
    const b = generateExecutiveSummary(high.maturityBand, high.composite, high.dimensions, high.insights, high.burdenIndex);
    expect(a.join('\n')).not.toBe(b.join('\n'));
  });

  it('the narrative contains no unrendered placeholders', () => {
    const profile = scoreAssessment('exp-p', buildUniformAnswers(2)).profile;
    const narrative = generateExecutiveSummary(
      profile.maturityBand,
      profile.composite,
      profile.dimensions,
      profile.insights,
      profile.burdenIndex,
    );
    for (const p of narrative) {
      expect(p, `unrendered placeholder in: ${p}`).not.toMatch(/\{\{|\}\}|<%|%>|\$\{/);
      expect(p, `unrendered undefined in: ${p}`).not.toMatch(/\bundefined\b/);
    }
  });
});
