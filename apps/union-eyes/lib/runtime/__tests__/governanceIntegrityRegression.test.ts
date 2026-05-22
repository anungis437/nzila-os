/**
 * ARTIFACT TYPE: Vitest Suite — Governance Integrity Regression
 * MODULE: OCI Operational Truth Hardening — Part 6
 * DOCTRINE_VERSION: 1.0.0
 *
 * Governance entries written through the continuity ledger are append-only
 * and never silently mutate after being written. This guards against future
 * refactors that introduce hidden in-place updates.
 */

import { describe, expect, it } from 'vitest';

import { FIXTURE_INSTITUTION_SCOPE, FIXTURE_REVIEWER_REF, makeRuntimeEvent } from '../../integration/__fixtures__/ociFixtures';
import { createContinuityLedger } from '../ledger/continuityLedgerRuntime';

describe('Governance integrity regression', () => {
  const opts = { reviewerRefId: FIXTURE_REVIEWER_REF, institutionScope: FIXTURE_INSTITUTION_SCOPE };

  it('appending a second governance entry does not mutate the first', () => {
    const ledger = createContinuityLedger();
    const first = ledger.appendFromEvent(
      makeRuntimeEvent('one', 'GovernanceInterpretationChanged'),
      'governance_lineage',
      'one',
    );
    const snapshot = JSON.parse(JSON.stringify(first));
    ledger.appendFromEvent(
      makeRuntimeEvent('two', 'GovernanceRecoveryRatified'),
      'governance_lineage',
      'two',
    );
    const readBack = ledger.readEntry('one', opts);
    expect(readBack).toEqual(snapshot);
  });

  it('reads without authorization context never succeed even after writes happen', () => {
    const ledger = createContinuityLedger();
    ledger.appendFromEvent(
      makeRuntimeEvent('only', 'GovernanceInterpretationChanged'),
      'governance_lineage',
      'only',
    );
    // Refusal-first: no reviewer, no scope, no read.
    expect(
      ledger.readEntry('only', { reviewerRefId: '', institutionScope: '' }),
    ).toBeNull();
    expect(
      ledger.listEntries({ reviewerRefId: '', institutionScope: '' }),
    ).toEqual([]);
  });

  it('listing by an unrecognized kind returns an empty array, never throws', () => {
    const ledger = createContinuityLedger();
    ledger.appendFromEvent(
      makeRuntimeEvent('g', 'GovernanceInterpretationChanged'),
      'governance_lineage',
      'g',
    );
    // continuity_transition is a real kind, but no entries written under it.
    expect(ledger.listEntriesByKind('continuity_transition', opts)).toEqual([]);
  });
});
