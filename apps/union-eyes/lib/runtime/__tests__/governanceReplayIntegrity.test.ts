/**
 * ARTIFACT TYPE: Vitest Suite — P4 Runtime Replay
 * MODULE: OCI Operational Truth Hardening — Part 5
 * DOCTRINE_VERSION: 1.0.0
 *
 * Governance replay integrity: governance-kind ledger entries replay without
 * corruption and never mix with non-governance entries on scoped reads.
 */

import { describe, expect, it } from 'vitest';

import { FIXTURE_INSTITUTION_SCOPE, FIXTURE_REVIEWER_REF, makeRuntimeEvent } from '../../integration/__fixtures__/ociFixtures';
import { createContinuityLedger } from '../ledger/continuityLedgerRuntime';

describe('Governance replay integrity', () => {
  const opts = { reviewerRefId: FIXTURE_REVIEWER_REF, institutionScope: FIXTURE_INSTITUTION_SCOPE };

  it('a governance entry round-trips structurally identical', () => {
    const ledger = createContinuityLedger();
    const entry = ledger.appendFromEvent(
      makeRuntimeEvent('gov-1', 'GovernanceInterpretationChanged'),
      'governance_lineage',
      'gov-entry-1',
    );
    const replayed = JSON.parse(JSON.stringify(entry));
    expect(replayed).toEqual(entry);
  });

  it('listEntriesByKind isolates governance entries from onboarding entries', () => {
    const ledger = createContinuityLedger();
    ledger.appendFromEvent(
      makeRuntimeEvent('g-1', 'GovernanceInterpretationChanged'),
      'governance_lineage',
      'g1',
    );
    ledger.appendFromEvent(
      makeRuntimeEvent('o-1', 'OnboardingSurvivabilityImproved'),
      'onboarding_survivability_evolution',
      'o1',
    );
    const governance = ledger.listEntriesByKind('governance_lineage', opts);
    const onboarding = ledger.listEntriesByKind('onboarding_survivability_evolution', opts);
    expect(governance.map((e) => e.entryId)).toEqual(['g1']);
    expect(onboarding.map((e) => e.entryId)).toEqual(['o1']);
  });

  it('two ledgers seeded from the same governance stream produce identical entries', () => {
    const events = [
      makeRuntimeEvent('seq-1', 'GovernanceInterpretationChanged', '2026-01-01T00:00:00.000Z'),
      makeRuntimeEvent('seq-2', 'GovernanceRecoveryRatified', '2026-02-01T00:00:00.000Z'),
      makeRuntimeEvent('seq-3', 'GovernanceInterpretationChanged', '2026-03-01T00:00:00.000Z'),
    ];
    const a = createContinuityLedger();
    const b = createContinuityLedger();
    for (let i = 0; i < events.length; i++) {
      a.appendFromEvent(events[i], 'governance_lineage', `entry-${i}`);
      b.appendFromEvent(events[i], 'governance_lineage', `entry-${i}`);
    }
    expect(a.listEntries(opts)).toEqual(b.listEntries(opts));
  });
});
