/**
 * ARTIFACT TYPE: Vitest Integration Suite
 * MODULE: OCI Operational Truth Hardening — Part 1
 * DOCTRINE_VERSION: 1.0.0
 *
 * Cross-product state evolution: when an institution's reading evolves
 * over time, the intelligence layer must reflect the evolution honestly —
 * neither inventing change nor flattening it.
 */

import { describe, expect, it } from 'vitest';

import {
  buildGradedAnswers,
  makeGrant,
  makeTrajectory,
} from './__fixtures__/ociFixtures';
import { scoreAssessment } from '../icra/scoring';
import { createContinuityIntelligenceRegistry } from '../intelligence/network/continuityIntelligenceRegistry';
import { createIntelligenceNetworkEngine } from '../intelligence/network/intelligenceNetworkEngine';
import { K_ANONYMITY_FLOOR } from '../intelligence/ethics/intelligenceEthicsValidators';

describe('Cross-product state evolution — OCRA readings flow into intelligence honestly', () => {
  it('two OCRA readings on the same institution at different times can both be ingested', () => {
    const t1 = scoreAssessment('inst:a:t1', buildGradedAnswers((i) => (i % 3) as 0 | 1 | 2));
    const t2 = scoreAssessment('inst:a:t2', buildGradedAnswers((i) => ((i + 1) % 5) as 0 | 1 | 2 | 3 | 4));

    expect(t1.profile.assessmentId).not.toBe(t2.profile.assessmentId);

    const registry = createContinuityIntelligenceRegistry();
    registry.grant(makeGrant('inst-a'));
    const engine = createIntelligenceNetworkEngine(registry);

    const r1 = engine.ingestTrajectories([
      makeTrajectory('inst-a', '2026-01-01T00:00:00.000Z', t1.profile.maturityBand.id),
    ]);
    const r2 = engine.ingestTrajectories([
      makeTrajectory('inst-a', '2026-04-01T00:00:00.000Z', t2.profile.maturityBand.id),
    ]);
    expect(r1.accepted).toHaveLength(1);
    expect(r2.accepted).toHaveLength(1);
  });

  it('the baseline aggregates at least k institutions before producing a reading', () => {
    const registry = createContinuityIntelligenceRegistry();
    const engine = createIntelligenceNetworkEngine(registry);
    for (let i = 0; i < K_ANONYMITY_FLOOR; i++) {
      registry.grant(makeGrant(`evo-${i}`));
      engine.ingestTrajectories([
        makeTrajectory(`evo-${i}`, '2026-03-01T00:00:00.000Z', 'stabilizing'),
      ]);
    }
    const envelope = engine.composeBaseline('labour_union', 'evolution:baseline', '2026-03-01T00:00:00.000Z');
    expect(envelope.contributingInstitutions).toBeGreaterThanOrEqual(K_ANONYMITY_FLOOR);
  });

  it('a withdrawn participant\'s subsequent records are refused', () => {
    const registry = createContinuityIntelligenceRegistry();
    registry.grant(makeGrant('withdrawer'));
    const engine = createIntelligenceNetworkEngine(registry);
    const ok = engine.ingestTrajectories([
      makeTrajectory('withdrawer', '2026-03-01T00:00:00.000Z', 'holding'),
    ]);
    expect(ok.accepted).toHaveLength(1);
    registry.withdraw({
      institutionRefHash: 'hash_withdrawer00',
      withdrawnAt: '2026-03-15T00:00:00.000Z',
      reviewerRefId: 'reviewer:test',
    });
    const blocked = engine.ingestTrajectories([
      makeTrajectory('withdrawer', '2026-04-01T00:00:00.000Z', 'stabilizing'),
    ]);
    expect(blocked.accepted).toHaveLength(0);
  });
});
