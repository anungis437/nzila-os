/**
 * ARTIFACT TYPE: Vitest Suite — K-Anonymity Regression
 * MODULE: OCI Operational Truth Hardening — Part 7
 * DOCTRINE_VERSION: 1.0.0
 *
 * Long-running regression for the network k-anonymity floor (K=5). Aggregated
 * envelopes below the floor must mark themselves unreadable; envelopes at or
 * above the floor must be readable. No off-by-one drift is tolerated.
 */

import { describe, expect, it } from 'vitest';

import { K_ANONYMITY_FLOOR } from '../ethics/intelligenceEthicsValidators';
import { createContinuityIntelligenceRegistry } from '../network/continuityIntelligenceRegistry';
import { createIntelligenceNetworkEngine } from '../network/intelligenceNetworkEngine';
import { FIXTURE_OBSERVED_AT, makeGrant, makeTrajectory } from '../../integration/__fixtures__/ociFixtures';

function seedTrajectories(count: number) {
  const registry = createContinuityIntelligenceRegistry();
  for (let i = 0; i < count; i++) {
    registry.grant(makeGrant(`m${i}`));
  }
  const engine = createIntelligenceNetworkEngine(registry);
  const records = Array.from({ length: count }, (_, i) =>
    makeTrajectory(`m${i}`, FIXTURE_OBSERVED_AT, 'stabilizing'),
  );
  const result = engine.ingestTrajectories(records);
  expect(result.rejections).toEqual([]);
  return { engine, accepted: result.accepted.length };
}

describe('K-anonymity regression — sector baseline composition', () => {
  it(`floor is exactly ${K_ANONYMITY_FLOOR}`, () => {
    expect(K_ANONYMITY_FLOOR).toBe(5);
  });

  it('a cohort one below the floor is not readable', () => {
    const { engine } = seedTrajectories(K_ANONYMITY_FLOOR - 1);
    const env = engine.composeBaseline('labour_union', 'b-below', '2026-01-02T00:00:00.000Z');
    expect(env.readable).toBe(false);
    expect(env.contributingInstitutions).toBe(K_ANONYMITY_FLOOR - 1);
  });

  it('a cohort at the floor is readable', () => {
    const { engine } = seedTrajectories(K_ANONYMITY_FLOOR);
    const env = engine.composeBaseline('labour_union', 'b-at', '2026-01-02T00:00:00.000Z');
    expect(env.readable).toBe(true);
    expect(env.contributingInstitutions).toBe(K_ANONYMITY_FLOOR);
  });

  it('a cohort above the floor remains readable', () => {
    const { engine } = seedTrajectories(K_ANONYMITY_FLOOR + 3);
    const env = engine.composeBaseline('labour_union', 'b-above', '2026-01-02T00:00:00.000Z');
    expect(env.readable).toBe(true);
    expect(env.contributingInstitutions).toBe(K_ANONYMITY_FLOOR + 3);
  });
});
