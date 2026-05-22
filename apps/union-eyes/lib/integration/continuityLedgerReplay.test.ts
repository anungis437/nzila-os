/**
 * ARTIFACT TYPE: Vitest Persistence Suite
 * MODULE: OCI Operational Truth Hardening — Part 2
 * DOCTRINE_VERSION: 1.0.0
 */

import { describe, expect, it } from 'vitest';

import { FIXTURE_INSTITUTION_SCOPE, FIXTURE_REVIEWER_REF, makeRuntimeEvent } from './__fixtures__/ociFixtures';
import { createContinuityLedger } from '../runtime/ledger/continuityLedgerRuntime';

describe('Continuity ledger replay — append-only + reviewer-led integrity', () => {
  it('appending the same event twice yields two distinct ledger entries', () => {
    const ledger = createContinuityLedger();
    const event = makeRuntimeEvent('replay-evt', 'GovernanceInterpretationChanged');
    ledger.appendFromEvent(event, 'governance_lineage', 'entry-1');
    ledger.appendFromEvent(event, 'governance_lineage', 'entry-2');
    const rows = ledger.listEntries({
      reviewerRefId: FIXTURE_REVIEWER_REF,
      institutionScope: FIXTURE_INSTITUTION_SCOPE,
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].entryId).not.toBe(rows[1].entryId);
  });

  it('an entry references the originating event via relatedEventIds', () => {
    const ledger = createContinuityLedger();
    const event = makeRuntimeEvent('origin-evt', 'OnboardingSurvivabilityImproved');
    const entry = ledger.appendFromEvent(event, 'onboarding_survivability_evolution', 'entry-x');
    expect(entry.relatedEventIds).toContain('origin-evt');
    expect(entry.institutionScope).toBe(event.institutionScope);
    expect(entry.statedAt).toBe(event.observedAt);
  });

  it('a JSON round-tripped ledger entry remains structurally equivalent', () => {
    const ledger = createContinuityLedger();
    const entry = ledger.appendFromEvent(
      makeRuntimeEvent('rt-evt', 'GovernanceInterpretationChanged'),
      'governance_lineage',
      'entry-rt',
    );
    const replayed = JSON.parse(JSON.stringify(entry));
    expect(replayed).toEqual(entry);
  });
});
