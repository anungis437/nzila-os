import { describe, expect, it } from 'vitest';

import type {
  AnonymisedInstitutionHandle,
  ContinuityDebtEvolutionRecord,
  ContinuityTrajectoryRecord,
  GovernanceEntropyDriftRecord,
  StewardshipEvolutionRecord,
  SurvivabilityProgressionRecord,
} from '../contracts/intelligenceContracts';
import { K_ANONYMITY_FLOOR } from '../ethics/intelligenceEthicsValidators';
import {
  composeSectorContinuityObservatories,
  composeSectorContinuityObservatory,
} from '../observatory/sectorContinuityObservatory';

const REVIEWER = 'reviewer:obs';

function handle(
  hashSuffix: string,
  sector: AnonymisedInstitutionHandle['sector'] = 'labour_union',
  contributedAt = '2026-01-01T00:00:00.000Z',
): AnonymisedInstitutionHandle {
  return {
    institutionRefHash: `hash_${hashSuffix.padEnd(8, '0')}`,
    sector,
    contributedAt,
  };
}

function trajectory(
  hashSuffix: string,
  observedAt: string,
  band: ContinuityTrajectoryRecord['band'],
  sector: AnonymisedInstitutionHandle['sector'] = 'labour_union',
): ContinuityTrajectoryRecord {
  return {
    trajectoryId: `traj:${hashSuffix}:${observedAt}`,
    handle: handle(hashSuffix, sector),
    observedAt,
    band,
    reviewerRefId: REVIEWER,
  };
}

function drift(
  hashSuffix: string,
  observedAt: string,
  driftBand: GovernanceEntropyDriftRecord['drift'],
  sector: AnonymisedInstitutionHandle['sector'] = 'labour_union',
): GovernanceEntropyDriftRecord {
  return {
    driftId: `drift:${hashSuffix}:${observedAt}`,
    handle: handle(hashSuffix, sector),
    observedAt,
    drift: driftBand,
    reviewerRefId: REVIEWER,
  };
}

function stewardship(
  hashSuffix: string,
  observedAt: string,
  evolution: StewardshipEvolutionRecord['evolution'],
  sector: AnonymisedInstitutionHandle['sector'] = 'labour_union',
): StewardshipEvolutionRecord {
  return {
    evolutionId: `stew:${hashSuffix}:${observedAt}`,
    handle: handle(hashSuffix, sector),
    observedAt,
    evolution,
    reviewerRefId: REVIEWER,
  };
}

function survivability(
  hashSuffix: string,
  observedAt: string,
  progression: SurvivabilityProgressionRecord['progression'],
  sector: AnonymisedInstitutionHandle['sector'] = 'labour_union',
): SurvivabilityProgressionRecord {
  return {
    progressionId: `surv:${hashSuffix}:${observedAt}`,
    handle: handle(hashSuffix, sector),
    observedAt,
    progression,
    reviewerRefId: REVIEWER,
  };
}

function debt(
  hashSuffix: string,
  observedAt: string,
  trend: ContinuityDebtEvolutionRecord['trend'],
  sector: AnonymisedInstitutionHandle['sector'] = 'labour_union',
): ContinuityDebtEvolutionRecord {
  return {
    debtId: `debt:${hashSuffix}:${observedAt}`,
    handle: handle(hashSuffix, sector),
    observedAt,
    trend,
    reviewerRefId: REVIEWER,
  };
}

describe('sector continuity observatory', () => {
  it('refuses readability below the k-anonymity floor', () => {
    const count = K_ANONYMITY_FLOOR - 1;
    const records = {
      trajectories: Array.from({ length: count }, (_, i) =>
        trajectory(String(i), '2026-02-01T00:00:00.000Z', 'holding'),
      ),
      drifts: [],
      stewardships: [],
      survivabilities: [],
      debts: [],
    };

    const o = composeSectorContinuityObservatory({
      sector: 'labour_union',
      observatoryId: 'obs:labour',
      composedAt: '2026-03-01T00:00:00.000Z',
      records,
    });

    expect(o.readable).toBe(false);
    expect(o.doctrineSafeReportLines[0]).toContain('withheld');
    expect(o.stewardshipTransferTheme).toBe('not_yet_readable');
    expect(o.onboardingSurvivabilityPattern).toBe('not_yet_readable');
    expect(o.modernizationFragilityArchetype).toBe('not_yet_readable');
  });

  it('uses deterministic preprocessing (latest per institution)', () => {
    const records = {
      trajectories: [
        trajectory('1', '2026-01-01T00:00:00.000Z', 'regressing'),
        trajectory('1', '2026-02-01T00:00:00.000Z', 'stabilizing'),
        trajectory('2', '2026-02-01T00:00:00.000Z', 'holding'),
        trajectory('3', '2026-02-01T00:00:00.000Z', 'holding'),
        trajectory('4', '2026-02-01T00:00:00.000Z', 'holding'),
        trajectory('5', '2026-02-01T00:00:00.000Z', 'holding'),
      ],
      drifts: [
        drift('1', '2026-02-01T00:00:00.000Z', 'holding'),
        drift('2', '2026-02-01T00:00:00.000Z', 'holding'),
        drift('3', '2026-02-01T00:00:00.000Z', 'holding'),
        drift('4', '2026-02-01T00:00:00.000Z', 'holding'),
        drift('5', '2026-02-01T00:00:00.000Z', 'holding'),
      ],
      stewardships: [
        stewardship('1', '2026-02-01T00:00:00.000Z', 'holding'),
        stewardship('2', '2026-02-01T00:00:00.000Z', 'holding'),
        stewardship('3', '2026-02-01T00:00:00.000Z', 'holding'),
        stewardship('4', '2026-02-01T00:00:00.000Z', 'holding'),
        stewardship('5', '2026-02-01T00:00:00.000Z', 'holding'),
      ],
      survivabilities: [
        survivability('1', '2026-02-01T00:00:00.000Z', 'holding'),
        survivability('2', '2026-02-01T00:00:00.000Z', 'holding'),
        survivability('3', '2026-02-01T00:00:00.000Z', 'holding'),
        survivability('4', '2026-02-01T00:00:00.000Z', 'holding'),
        survivability('5', '2026-02-01T00:00:00.000Z', 'holding'),
      ],
      debts: [
        debt('1', '2026-02-01T00:00:00.000Z', 'holding'),
        debt('2', '2026-02-01T00:00:00.000Z', 'holding'),
        debt('3', '2026-02-01T00:00:00.000Z', 'holding'),
        debt('4', '2026-02-01T00:00:00.000Z', 'holding'),
        debt('5', '2026-02-01T00:00:00.000Z', 'holding'),
      ],
    };

    const o = composeSectorContinuityObservatory({
      sector: 'labour_union',
      observatoryId: 'obs:labour',
      composedAt: '2026-03-01T00:00:00.000Z',
      records,
    });

    expect(o.readable).toBe(true);
    expect(o.continuityTrendAggregation.trajectoryDistribution.regressing).toBe(0);
    expect(o.continuityTrendAggregation.trajectoryDistribution.stabilizing).toBe(1);
  });

  it('derives stewardship theme, onboarding pattern, and fragility archetype from low-cardinality distributions', () => {
    const records = {
      trajectories: [
        trajectory('1', '2026-02-01T00:00:00.000Z', 'regressing'),
        trajectory('2', '2026-02-01T00:00:00.000Z', 'regressing'),
        trajectory('3', '2026-02-01T00:00:00.000Z', 'holding'),
        trajectory('4', '2026-02-01T00:00:00.000Z', 'holding'),
        trajectory('5', '2026-02-01T00:00:00.000Z', 'holding'),
      ],
      drifts: [
        drift('1', '2026-02-01T00:00:00.000Z', 'regressing'),
        drift('2', '2026-02-01T00:00:00.000Z', 'regressing'),
        drift('3', '2026-02-01T00:00:00.000Z', 'holding'),
        drift('4', '2026-02-01T00:00:00.000Z', 'holding'),
        drift('5', '2026-02-01T00:00:00.000Z', 'holding'),
      ],
      stewardships: [
        stewardship('1', '2026-02-01T00:00:00.000Z', 'reconcentrating'),
        stewardship('2', '2026-02-01T00:00:00.000Z', 'reconcentrating'),
        stewardship('3', '2026-02-01T00:00:00.000Z', 'reconcentrating'),
        stewardship('4', '2026-02-01T00:00:00.000Z', 'holding'),
        stewardship('5', '2026-02-01T00:00:00.000Z', 'holding'),
      ],
      survivabilities: [
        survivability('1', '2026-02-01T00:00:00.000Z', 'weakening'),
        survivability('2', '2026-02-01T00:00:00.000Z', 'weakening'),
        survivability('3', '2026-02-01T00:00:00.000Z', 'weakening'),
        survivability('4', '2026-02-01T00:00:00.000Z', 'holding'),
        survivability('5', '2026-02-01T00:00:00.000Z', 'holding'),
      ],
      debts: [
        debt('1', '2026-02-01T00:00:00.000Z', 'accumulating'),
        debt('2', '2026-02-01T00:00:00.000Z', 'accumulating'),
        debt('3', '2026-02-01T00:00:00.000Z', 'accumulating'),
        debt('4', '2026-02-01T00:00:00.000Z', 'holding'),
        debt('5', '2026-02-01T00:00:00.000Z', 'holding'),
      ],
    };

    const o = composeSectorContinuityObservatory({
      sector: 'labour_union',
      observatoryId: 'obs:labour',
      composedAt: '2026-03-01T00:00:00.000Z',
      records,
    });

    expect(o.stewardshipTransferTheme).toBe('concentrated_stewardship_dependency');
    expect(o.onboardingSurvivabilityPattern).toBe('survivability_weakening');
    expect(o.modernizationFragilityArchetype).toBe('brittle_transition');
    expect(o.doctrineSafeReportLines.join(' ')).toContain('non-ranking');
  });

  it('composes sector continuity observatories for multiple sectors', () => {
    const records = {
      trajectories: [
        trajectory('1', '2026-02-01T00:00:00.000Z', 'holding', 'labour_union'),
        trajectory('2', '2026-02-01T00:00:00.000Z', 'holding', 'labour_union'),
        trajectory('3', '2026-02-01T00:00:00.000Z', 'holding', 'labour_union'),
        trajectory('4', '2026-02-01T00:00:00.000Z', 'holding', 'labour_union'),
        trajectory('5', '2026-02-01T00:00:00.000Z', 'holding', 'labour_union'),
      ],
      drifts: [],
      stewardships: [],
      survivabilities: [],
      debts: [],
    };

    const out = composeSectorContinuityObservatories({
      sectors: ['healthcare', 'labour_union'],
      composedAt: '2026-03-01T00:00:00.000Z',
      records,
      observatoryIdPrefix: 'test-observatory',
    });

    expect(out).toHaveLength(2);
    expect(out[0].observatoryId).toBe('test-observatory:healthcare');
    expect(out[1].observatoryId).toBe('test-observatory:labour_union');
    expect(out[0].readable).toBe(false);
    expect(out[1].readable).toBe(true);
  });
});
