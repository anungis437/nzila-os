/**
 * ARTIFACT TYPE: Vitest Persistence Suite
 * MODULE: OCI Operational Truth Hardening — Part 2
 * DOCTRINE_VERSION: 1.0.0
 */

import { describe, expect, it } from 'vitest';

import { FIXTURE_INSTITUTION_SCOPE, FIXTURE_REVIEWER_REF, makeRuntimeEvent } from './__fixtures__/ociFixtures';
import { createContinuityLedger } from '../runtime/ledger/continuityLedgerRuntime';

describe('Runtime round-trip persistence — ledger state survives serialization', () => {
  it('a serialized list of ledger entries replays into structurally identical rows', () => {
    const ledger = createContinuityLedger();
    for (let i = 0; i < 5; i++) {
      ledger.appendFromEvent(
        makeRuntimeEvent(`evt-${i}`, 'GovernanceInterpretationChanged', `2026-0${i + 1}-01T00:00:00.000Z`),
        'governance_lineage',
        `entry-${i}`,
      );
    }
    const rows = ledger.listEntries({
      reviewerRefId: FIXTURE_REVIEWER_REF,
      institutionScope: FIXTURE_INSTITUTION_SCOPE,
    });
    const replayed = JSON.parse(JSON.stringify(rows));
    expect(replayed).toEqual(rows);
    expect(replayed).toHaveLength(5);
  });

  it('the sort order over statedAt is stable across rounds', () => {
    const ledger = createContinuityLedger();
    ledger.appendFromEvent(
      makeRuntimeEvent('z', 'GovernanceInterpretationChanged', '2026-12-01T00:00:00.000Z'),
      'governance_lineage',
      'entry-z',
    );
    ledger.appendFromEvent(
      makeRuntimeEvent('a', 'GovernanceInterpretationChanged', '2026-01-01T00:00:00.000Z'),
      'governance_lineage',
      'entry-a',
    );
    const opts = { reviewerRefId: FIXTURE_REVIEWER_REF, institutionScope: FIXTURE_INSTITUTION_SCOPE };
    const first = ledger.listEntries(opts).map((e) => e.entryId);
    const second = ledger.listEntries(opts).map((e) => e.entryId);
    expect(first).toEqual(second);
    expect(first[0]).toBe('entry-a');
  });
});
