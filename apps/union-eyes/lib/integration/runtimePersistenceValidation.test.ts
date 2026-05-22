/**
 * ARTIFACT TYPE: Vitest Persistence Suite
 * MODULE: OCI Operational Truth Hardening — Part 2
 * DOCTRINE_VERSION: 1.0.0
 *
 * Runtime persistence validation: the ledger must enforce institution scope,
 * preserve append-only ordering, and refuse reads that lack a reviewer.
 */

import { describe, expect, it } from 'vitest';

import { FIXTURE_INSTITUTION_SCOPE, FIXTURE_REVIEWER_REF, makeRuntimeEvent } from './__fixtures__/ociFixtures';
import { createContinuityLedger } from '../runtime/ledger/continuityLedgerRuntime';

describe('Runtime persistence validation — ledger composition contract', () => {
  it('listEntries refuses to return rows when reviewerRefId is missing', () => {
    const ledger = createContinuityLedger();
    ledger.appendFromEvent(
      makeRuntimeEvent('e-1', 'GovernanceInterpretationChanged'),
      'governance_lineage',
      'entry-1',
    );
    const result = ledger.listEntries({ reviewerRefId: '', institutionScope: FIXTURE_INSTITUTION_SCOPE });
    expect(result).toEqual([]);
  });

  it('listEntries refuses to return rows when institutionScope is missing', () => {
    const ledger = createContinuityLedger();
    ledger.appendFromEvent(
      makeRuntimeEvent('e-2', 'GovernanceInterpretationChanged'),
      'governance_lineage',
      'entry-2',
    );
    const result = ledger.listEntries({ reviewerRefId: FIXTURE_REVIEWER_REF, institutionScope: '' });
    expect(result).toEqual([]);
  });

  it('readEntry never crosses institution scopes', () => {
    const ledger = createContinuityLedger();
    ledger.appendFromEvent(
      makeRuntimeEvent('e-3', 'GovernanceInterpretationChanged'),
      'governance_lineage',
      'entry-3',
    );
    const result = ledger.readEntry('entry-3', {
      reviewerRefId: FIXTURE_REVIEWER_REF,
      institutionScope: 'institution:other:scope',
    });
    expect(result).toBeNull();
  });

  it('listEntries is deterministic over statedAt then entryId', () => {
    const ledger = createContinuityLedger();
    ledger.appendFromEvent(
      makeRuntimeEvent('e-c', 'GovernanceInterpretationChanged', '2026-03-01T00:00:00.000Z'),
      'governance_lineage',
      'entry-c',
    );
    ledger.appendFromEvent(
      makeRuntimeEvent('e-a', 'GovernanceInterpretationChanged', '2026-01-01T00:00:00.000Z'),
      'governance_lineage',
      'entry-a',
    );
    ledger.appendFromEvent(
      makeRuntimeEvent('e-b', 'GovernanceInterpretationChanged', '2026-02-01T00:00:00.000Z'),
      'governance_lineage',
      'entry-b',
    );
    const result = ledger.listEntries({
      reviewerRefId: FIXTURE_REVIEWER_REF,
      institutionScope: FIXTURE_INSTITUTION_SCOPE,
    });
    expect(result.map((e) => e.entryId)).toEqual(['entry-a', 'entry-b', 'entry-c']);
  });

  it('listEntriesByKind narrows by kind and respects scope guard', () => {
    const ledger = createContinuityLedger();
    ledger.appendFromEvent(
      makeRuntimeEvent('e-g', 'GovernanceInterpretationChanged'),
      'governance_lineage',
      'entry-g',
    );
    ledger.appendFromEvent(
      makeRuntimeEvent('e-o', 'OnboardingSurvivabilityImproved'),
      'onboarding_survivability_evolution',
      'entry-o',
    );
    const governance = ledger.listEntriesByKind('governance_lineage', {
      reviewerRefId: FIXTURE_REVIEWER_REF,
      institutionScope: FIXTURE_INSTITUTION_SCOPE,
    });
    expect(governance.map((e) => e.entryId)).toEqual(['entry-g']);
  });
});
