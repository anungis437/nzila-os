/**
 * Opt-in aggregate intelligence pipeline invariants.
 */

import { describe, expect, it } from 'vitest';

import {
  BoundaryBreachError,
  K_ANONYMITY_THRESHOLD,
  aggregateBySector,
  assertNoIndividualIdentifiers,
  selectOptedIn,
} from '../aggregateIntelligence';
import type { AggregateIntake, InstitutionalSectorId } from '../types';

function makeIntake(overrides: Partial<AggregateIntake> = {}): AggregateIntake {
  return {
    institutionId: 'inst-1',
    sectorId: 'union-cba-administration',
    aggregateOptIn: true,
    optInRecordedAt: '2026-05-01T00:00:00.000Z',
    stewardshipDensity: 4,
    continuityFragility: 12,
    burdenPatternCount: 5,
    presentBurdenPatternIds: ['id-single-interpreter', 'op-process-by-one-steward'],
    ...overrides,
  };
}

function makeCohort(
  sectorId: InstitutionalSectorId,
  count: number,
  prefix = 'inst',
): AggregateIntake[] {
  return Array.from({ length: count }, (_, i) =>
    makeIntake({
      institutionId: `${prefix}-${i + 1}`,
      sectorId,
      stewardshipDensity: 3 + i,
      continuityFragility: 10 + i,
      burdenPatternCount: 4 + (i % 3),
    }),
  );
}

describe('selectOptedIn', () => {
  it('keeps only intakes with aggregateOptIn === true', () => {
    const intakes = [
      makeIntake({ institutionId: 'a', aggregateOptIn: true }),
      makeIntake({ institutionId: 'b', aggregateOptIn: false }),
    ];
    const out = selectOptedIn(intakes);
    expect(out).toHaveLength(1);
    expect(out[0]?.institutionId).toBe('a');
  });

  it('does not coerce truthy values into opt-in', () => {
    const intakes = [
      // Force a non-boolean to verify the strict equality check.
      makeIntake({ aggregateOptIn: 'yes' as unknown as boolean }),
    ];
    expect(selectOptedIn(intakes)).toEqual([]);
  });
});

describe('assertNoIndividualIdentifiers', () => {
  it('accepts a clean intake', () => {
    expect(() => assertNoIndividualIdentifiers(makeIntake())).not.toThrow();
  });

  it('rejects intakes carrying forbidden identifier fields', () => {
    const dirty = {
      ...makeIntake(),
      email: 'someone@example.com',
    } as unknown as AggregateIntake;
    expect(() => assertNoIndividualIdentifiers(dirty)).toThrow(
      BoundaryBreachError,
    );
  });

  it('rejects intakes with role-tied person names', () => {
    const dirty = {
      ...makeIntake(),
      chairName: 'A. Person',
    } as unknown as AggregateIntake;
    expect(() => assertNoIndividualIdentifiers(dirty)).toThrow(
      BoundaryBreachError,
    );
  });

  it('requires an explicit boolean opt-in flag', () => {
    const dirty = {
      ...makeIntake(),
      aggregateOptIn: 1 as unknown as boolean,
    };
    expect(() => assertNoIndividualIdentifiers(dirty)).toThrow(
      BoundaryBreachError,
    );
  });

  it('requires a non-empty optInRecordedAt timestamp', () => {
    const dirty = makeIntake({ optInRecordedAt: '' });
    expect(() => assertNoIndividualIdentifiers(dirty)).toThrow(
      BoundaryBreachError,
    );
  });
});

describe('aggregateBySector', () => {
  it('exposes the doctrinal k-anonymity threshold of 5', () => {
    expect(K_ANONYMITY_THRESHOLD).toBe(5);
  });

  it('refuses to lower the k-anonymity threshold below the doctrine default', () => {
    expect(() =>
      aggregateBySector([], { minimumK: 2 }),
    ).toThrow(BoundaryBreachError);
  });

  it('suppresses sectors with fewer than k contributing institutions', () => {
    const intakes = makeCohort('union-cba-administration', 3);
    const result = aggregateBySector(intakes);
    expect(result.aggregates).toEqual([]);
    expect(result.suppressedSectors).toHaveLength(1);
    expect(result.suppressedSectors[0]).toMatchObject({
      sectorId: 'union-cba-administration',
      contributingInstitutionCount: 3,
      reason: 'below-k-anonymity-threshold',
    });
  });

  it('returns aggregates for sectors meeting the threshold', () => {
    const intakes = makeCohort('healthcare-clinical-governance', 6);
    const result = aggregateBySector(intakes);
    expect(result.minimumKApplied).toBe(K_ANONYMITY_THRESHOLD);
    expect(result.suppressedSectors).toEqual([]);
    expect(result.aggregates).toHaveLength(1);
    const agg = result.aggregates[0]!;
    expect(agg.sectorId).toBe('healthcare-clinical-governance');
    expect(agg.contributingInstitutionCount).toBe(6);
    expect(agg.stewardshipDensity.low).toBeLessThanOrEqual(
      agg.stewardshipDensity.median,
    );
    expect(agg.stewardshipDensity.median).toBeLessThanOrEqual(
      agg.stewardshipDensity.high,
    );
    // Pattern frequencies are bounded fractions.
    for (const freq of Object.values(agg.burdenPatternFrequencies)) {
      expect(freq).toBeGreaterThan(0);
      expect(freq).toBeLessThanOrEqual(1);
    }
  });

  it('runs the boundary guard before any aggregation', () => {
    const intakes = [
      ...makeCohort('healthcare-clinical-governance', 5),
      { ...makeIntake(), notes: 'free text' } as unknown as AggregateIntake,
    ];
    expect(() => aggregateBySector(intakes)).toThrow(BoundaryBreachError);
  });

  it('counts each institution once even when it submits multiple intakes', () => {
    const dupSector: InstitutionalSectorId = 'municipal-government';
    const intakes: AggregateIntake[] = [
      ...makeCohort(dupSector, 5),
      makeIntake({
        institutionId: 'inst-1',
        sectorId: dupSector,
        optInRecordedAt: '2026-06-01T00:00:00.000Z',
        stewardshipDensity: 99,
      }),
    ];
    const result = aggregateBySector(intakes);
    expect(result.aggregates[0]?.contributingInstitutionCount).toBe(5);
  });
});
