/**
 * ARTIFACT TYPE: Vitest Suite — Aggregation Privacy Integrity
 * MODULE: OCI Operational Truth Hardening — Part 7
 * DOCTRINE_VERSION: 1.0.0
 *
 * Aggregation must respect withdrawal: an institution that withdraws is
 * removed from future composeBaseline reads. The aggregate count must drop
 * accordingly. We never assert a historical reading was wrong; we just stop
 * including the withdrawer going forward.
 */

import { describe, expect, it } from 'vitest';

import { K_ANONYMITY_FLOOR } from '../ethics/intelligenceEthicsValidators';
import { createContinuityIntelligenceRegistry } from '../network/continuityIntelligenceRegistry';
import { createIntelligenceNetworkEngine } from '../network/intelligenceNetworkEngine';
import { FIXTURE_OBSERVED_AT, FIXTURE_REVIEWER_REF, makeGrant, makeTrajectory } from '../../integration/__fixtures__/ociFixtures';

function buildSeededEngine(count: number) {
  const registry = createContinuityIntelligenceRegistry();
  for (let i = 0; i < count; i++) {
    registry.grant(makeGrant(`agg${i}`));
  }
  const engine = createIntelligenceNetworkEngine(registry);
  const records = Array.from({ length: count }, (_, i) =>
    makeTrajectory(`agg${i}`, FIXTURE_OBSERVED_AT, 'stabilizing'),
  );
  engine.ingestTrajectories(records);
  return { registry, engine };
}

describe('Aggregation privacy integrity — withdrawal honors continuity', () => {
  it('a withdrawer is removed from listActiveGrants', () => {
    const { registry } = buildSeededEngine(K_ANONYMITY_FLOOR + 1);
    const before = registry.listActiveGrants('labour_union').length;
    registry.withdraw({
      institutionRefHash: `hash_agg0${'0'.repeat(12 - 'agg0'.length)}`,
      withdrawnAt: '2026-01-03T00:00:00.000Z',
      reviewerRefId: FIXTURE_REVIEWER_REF,
    });
    const after = registry.listActiveGrants('labour_union').length;
    expect(after).toBe(before - 1);
  });

  it('a fresh ingest from a withdrawer is rejected', () => {
    const { registry, engine } = buildSeededEngine(K_ANONYMITY_FLOOR);
    const withdrawerHash = `hash_agg0${'0'.repeat(12 - 'agg0'.length)}`;
    registry.withdraw({
      institutionRefHash: withdrawerHash,
      withdrawnAt: '2026-01-03T00:00:00.000Z',
      reviewerRefId: FIXTURE_REVIEWER_REF,
    });
    const result = engine.ingestTrajectories([
      makeTrajectory('agg0', '2026-01-04T00:00:00.000Z', 'stabilizing'),
    ]);
    expect(result.accepted).toHaveLength(0);
    expect(result.rejections).toHaveLength(1);
  });
});
