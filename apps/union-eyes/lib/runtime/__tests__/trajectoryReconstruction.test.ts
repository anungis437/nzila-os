/**
 * ARTIFACT TYPE: Vitest Suite — P4 Runtime Replay
 * MODULE: OCI Operational Truth Hardening — Part 5
 * DOCTRINE_VERSION: 1.0.0
 *
 * Trajectory reconstruction: when a sequence of continuity events is replayed,
 * the order is determined by statedAt, never by insertion order.
 */

import { describe, expect, it } from 'vitest';

import { FIXTURE_INSTITUTION_SCOPE, FIXTURE_REVIEWER_REF, makeRuntimeEvent } from '../../integration/__fixtures__/ociFixtures';
import { createContinuityLedger } from '../ledger/continuityLedgerRuntime';

describe('Trajectory reconstruction', () => {
  const opts = { reviewerRefId: FIXTURE_REVIEWER_REF, institutionScope: FIXTURE_INSTITUTION_SCOPE };

  it('out-of-order inserts yield chronologically ordered reads', () => {
    const ledger = createContinuityLedger();
    ledger.appendFromEvent(
      makeRuntimeEvent('mid', 'GovernanceInterpretationChanged', '2026-06-01T00:00:00.000Z'),
      'governance_lineage',
      'mid',
    );
    ledger.appendFromEvent(
      makeRuntimeEvent('end', 'GovernanceInterpretationChanged', '2026-12-01T00:00:00.000Z'),
      'governance_lineage',
      'end',
    );
    ledger.appendFromEvent(
      makeRuntimeEvent('start', 'GovernanceInterpretationChanged', '2026-01-01T00:00:00.000Z'),
      'governance_lineage',
      'start',
    );
    const ids = ledger.listEntries(opts).map((e) => e.entryId);
    expect(ids).toEqual(['start', 'mid', 'end']);
  });

  it('events with identical statedAt are ordered deterministically by entryId', () => {
    const ledger = createContinuityLedger();
    const at = '2026-04-01T00:00:00.000Z';
    ledger.appendFromEvent(
      makeRuntimeEvent('z', 'GovernanceInterpretationChanged', at),
      'governance_lineage',
      'z',
    );
    ledger.appendFromEvent(
      makeRuntimeEvent('a', 'GovernanceInterpretationChanged', at),
      'governance_lineage',
      'a',
    );
    const ids = ledger.listEntries(opts).map((e) => e.entryId);
    expect(ids).toEqual(['a', 'z']);
  });
});
