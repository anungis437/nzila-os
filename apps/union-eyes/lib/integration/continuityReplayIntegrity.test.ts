/**
 * ARTIFACT TYPE: Vitest Integration Suite
 * MODULE: OCI Operational Truth Hardening — Part 1
 * DOCTRINE_VERSION: 1.0.0
 *
 * Continuity replay integrity:
 *
 * An OCRA reading must survive JSON serialization and replay without
 * deformation. This guards against silent loss when profiles cross
 * persistence boundaries (DB, cache, export, audit log).
 */

import { describe, expect, it } from 'vitest';

import { buildUniformAnswers, buildGradedAnswers } from './__fixtures__/ociFixtures';
import { scoreAssessment } from '../icra/scoring';

describe('Continuity replay integrity — JSON round-trip determinism', () => {
  it('the profile survives JSON serialization unchanged', () => {
    const { profile } = scoreAssessment('replay:uniform', buildUniformAnswers(2));
    const serialized = JSON.stringify(profile);
    const replayed = JSON.parse(serialized);
    expect(replayed).toEqual(profile);
  });

  it('two consecutive JSON round-trips remain stable', () => {
    const { profile } = scoreAssessment('replay:graded', buildGradedAnswers((i) => (i % 5) as 0 | 1 | 2 | 3 | 4));
    const once = JSON.parse(JSON.stringify(profile));
    const twice = JSON.parse(JSON.stringify(once));
    expect(twice).toEqual(once);
  });

  it('the trace survives JSON serialization unchanged', () => {
    const { trace } = scoreAssessment('replay:trace', buildUniformAnswers(3));
    const replayed = JSON.parse(JSON.stringify(trace));
    expect(replayed).toEqual(trace);
  });

  it('re-scoring after a round-trip of the answers produces an equivalent profile composite', () => {
    const answers = buildUniformAnswers(2);
    const roundTripped = JSON.parse(JSON.stringify(answers));
    const a = scoreAssessment('replay:rescored', answers).profile;
    const b = scoreAssessment('replay:rescored', roundTripped).profile;
    expect(b.composite).toBe(a.composite);
    expect(b.maturityBand.id).toBe(a.maturityBand.id);
    expect(b.dimensions).toEqual(a.dimensions);
  });

  it('the composite is integer and survives serialization without precision drift', () => {
    const { profile } = scoreAssessment('replay:composite', buildUniformAnswers(2));
    const replayed = JSON.parse(JSON.stringify(profile));
    expect(replayed.composite).toBe(profile.composite);
    expect(Number.isInteger(replayed.composite)).toBe(true);
  });
});
