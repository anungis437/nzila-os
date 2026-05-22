/**
 * ARTIFACT TYPE: Vitest Persistence Suite
 * MODULE: OCI Operational Truth Hardening — Part 2
 * DOCTRINE_VERSION: 1.0.0
 */

import { describe, expect, it } from 'vitest';

import { makeGrant, makeTrajectory } from './__fixtures__/ociFixtures';
import { createContinuityIntelligenceRegistry } from '../intelligence/network/continuityIntelligenceRegistry';
import { createIntelligenceNetworkEngine } from '../intelligence/network/intelligenceNetworkEngine';
import { K_ANONYMITY_FLOOR } from '../intelligence/ethics/intelligenceEthicsValidators';

describe('Intelligence aggregation persistence — baseline composition determinism', () => {
  it('composing the same baseline twice yields equivalent envelopes', () => {
    const registry = createContinuityIntelligenceRegistry();
    const engine = createIntelligenceNetworkEngine(registry);
    for (let i = 0; i < K_ANONYMITY_FLOOR; i++) {
      registry.grant(makeGrant(`agg-${i}`));
      engine.ingestTrajectories([
        makeTrajectory(`agg-${i}`, '2026-02-01T00:00:00.000Z', 'stabilizing'),
      ]);
    }
    const a = engine.composeBaseline('labour_union', 'baseline:det:a', '2026-02-01T00:00:00.000Z');
    const b = engine.composeBaseline('labour_union', 'baseline:det:b', '2026-02-01T00:00:00.000Z');
    // Different baseline ids, but the structural envelope (readable + cohort) is consistent.
    expect(a.readable).toBe(b.readable);
    expect(a.contributingInstitutions).toBe(b.contributingInstitutions);
  });

  it('baseline envelopes survive JSON round-trip', () => {
    const registry = createContinuityIntelligenceRegistry();
    const engine = createIntelligenceNetworkEngine(registry);
    for (let i = 0; i < K_ANONYMITY_FLOOR; i++) {
      registry.grant(makeGrant(`rt-${i}`));
      engine.ingestTrajectories([
        makeTrajectory(`rt-${i}`, '2026-02-01T00:00:00.000Z', 'holding'),
      ]);
    }
    const envelope = engine.composeBaseline('labour_union', 'baseline:rt', '2026-02-01T00:00:00.000Z');
    const replayed = JSON.parse(JSON.stringify(envelope));
    expect(replayed).toEqual(envelope);
  });
});
