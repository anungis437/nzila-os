/**
 * ARTIFACT TYPE: Vitest Suite — P4 Runtime Replay
 * MODULE: OCI Operational Truth Hardening — Part 5
 * DOCTRINE_VERSION: 1.0.0
 *
 * Continuity replay at runtime: the ledger is the source of truth for "what
 * we said about this institution." Replaying the ledger across a serialization
 * boundary must yield the same ordered statements.
 */

import { describe, expect, it } from 'vitest';

import { FIXTURE_INSTITUTION_SCOPE, FIXTURE_REVIEWER_REF, makeRuntimeEvent } from '../../integration/__fixtures__/ociFixtures';
import { createContinuityLedger } from '../ledger/continuityLedgerRuntime';

describe('Continuity replay runtime — full ledger reconstruction', () => {
  it('a ledger reconstructed from serialized entries replays them in the same order', () => {
    const original = createContinuityLedger();
    for (let i = 0; i < 6; i++) {
      original.appendFromEvent(
        makeRuntimeEvent(
          `evt-${i}`,
          'GovernanceInterpretationChanged',
          `2026-0${i + 1}-01T00:00:00.000Z`,
        ),
        'governance_lineage',
        `entry-${i}`,
      );
    }
    const opts = { reviewerRefId: FIXTURE_REVIEWER_REF, institutionScope: FIXTURE_INSTITUTION_SCOPE };
    const originalRows = original.listEntries(opts);

    // Serialize and rehydrate into a fresh ledger.
    const serialized = JSON.stringify(originalRows);
    const rehydrated = createContinuityLedger();
    for (const entry of JSON.parse(serialized)) {
      rehydrated.append(entry);
    }
    const rehydratedRows = rehydrated.listEntries(opts);
    expect(rehydratedRows).toEqual(originalRows);
  });

  it('replay never invents entries that were not in the source', () => {
    const original = createContinuityLedger();
    original.appendFromEvent(
      makeRuntimeEvent('only', 'GovernanceInterpretationChanged'),
      'governance_lineage',
      'entry-only',
    );
    const opts = { reviewerRefId: FIXTURE_REVIEWER_REF, institutionScope: FIXTURE_INSTITUTION_SCOPE };
    const rows = original.listEntries(opts);
    expect(rows).toHaveLength(1);

    const rehydrated = createContinuityLedger();
    for (const entry of JSON.parse(JSON.stringify(rows))) {
      rehydrated.append(entry);
    }
    expect(rehydrated.listEntries(opts)).toHaveLength(1);
  });
});
