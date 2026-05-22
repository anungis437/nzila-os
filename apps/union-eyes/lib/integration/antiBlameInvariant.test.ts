/**
 * ARTIFACT TYPE: Vitest Suite — Anti-Blame Invariant
 * MODULE: OCI Operational Truth Hardening — Part 8
 * DOCTRINE_VERSION: 1.0.0
 *
 * The narrative voice never blames the reader. We refuse second-person
 * accusatory phrasing of the form "why do you not / fail to / never ..."
 * regardless of underlying composite score.
 */

import { describe, expect, it } from 'vitest';

import { scoreAssessment } from '../icra/scoring';
import { generateExecutiveSummary } from '../icra-pdf/reportNarrativeEngine';
import { buildUniformAnswers } from './__fixtures__/ociFixtures';

const BLAME = /\bwhy do you (not|fail to|never)\b/i;
const ACCUSATORY = /\b(you (failed|neglected|forgot)|your fault)\b/i;

describe('Anti-blame invariant — narrative voice', () => {
  for (const score of [0, 1, 2, 3, 4] as const) {
    it(`does not produce blame phrasing at uniform score ${score}`, () => {
      const profile = scoreAssessment(`b-${score}`, buildUniformAnswers(score)).profile;
      const paragraphs = generateExecutiveSummary(
        profile.maturityBand,
        profile.composite,
        profile.dimensions,
        profile.insights,
        profile.burdenIndex,
      );
      for (const par of paragraphs) {
        expect(par, `blame phrasing in: ${par}`).not.toMatch(BLAME);
        expect(par, `accusatory phrasing in: ${par}`).not.toMatch(ACCUSATORY);
      }
    });
  }
});
