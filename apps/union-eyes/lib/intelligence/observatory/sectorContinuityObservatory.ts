/**
 * ARTIFACT TYPE: Observatory Engine
 * MODULE: OCI Intelligence Network
 * DOCTRINE_VERSION: 1.0.0
 *
 * Sector Continuity Observatory.
 *
 * Deterministic, anonymized, low-cardinality observatory layer for
 * longitudinal organizational intelligence. This module intentionally avoids any
 * generative path.
 *
 * Scope:
 *   - anonymized continuity trend aggregation
 *   - stewardship transfer themes
 *   - onboarding survivability patterns
 *   - modernization fragility archetypes
 *   - sector continuity observatories
 *
 * Guardrails:
 *   - aggregation only (no per-institution output)
 *   - low-cardinality analysis only (fixed enum buckets)
 *   - deterministic preprocessing (latest-per-institution)
 *   - doctrine-safe reporting (non-ranking, non-punitive wording)
 */

import type {
  ContinuityDebtEvolutionRecord,
  ContinuityDebtTrend,
  ContinuityTrajectoryBand,
  ContinuityTrajectoryRecord,
  GovernanceDriftBand,
  GovernanceEntropyDriftRecord,
  IntelligenceSector,
  SectorBaselineEnvelope,
  StewardshipEvolutionBand,
  StewardshipEvolutionRecord,
  SurvivabilityProgressionBand,
  SurvivabilityProgressionRecord,
} from '../contracts/intelligenceContracts';
import {
  composeSectorBaseline,
  type AggregationInputs,
} from '../network/networkAggregationModel';

export const SECTOR_CONTINUITY_OBSERVATORY_VERSION = '1.0.0' as const;

export type StewardshipTransferTheme =
  | 'distributed_stewardship_carry'
  | 'steady_stewardship_carry'
  | 'concentrated_stewardship_dependency'
  | 'not_yet_readable';

export type OnboardingSurvivabilityPattern =
  | 'survivability_strengthening'
  | 'survivability_holding'
  | 'survivability_weakening'
  | 'not_yet_readable';

export type ModernizationFragilityArchetype =
  | 'stable_modernization'
  | 'brittle_transition'
  | 'concentrated_stewardship_dependency'
  | 'onboarding_erosion'
  | 'transitional_variability'
  | 'not_yet_readable';

export interface ContinuityTrendAggregation {
  readonly trajectoryDistribution: Readonly<Record<ContinuityTrajectoryBand, number>>;
  readonly driftDistribution: Readonly<Record<GovernanceDriftBand, number>>;
  readonly debtDistribution: Readonly<Record<ContinuityDebtTrend, number>>;
}

export interface SectorContinuityObservatory {
  readonly observatoryId: string;
  readonly sector: IntelligenceSector;
  readonly composedAt: string;
  readonly readable: boolean;
  readonly contributingInstitutions: number;
  readonly baseline: SectorBaselineEnvelope;
  readonly continuityTrendAggregation: ContinuityTrendAggregation;
  readonly stewardshipTransferTheme: StewardshipTransferTheme;
  readonly onboardingSurvivabilityPattern: OnboardingSurvivabilityPattern;
  readonly modernizationFragilityArchetype: ModernizationFragilityArchetype;
  readonly doctrineSafeReportLines: ReadonlyArray<string>;
}

function latestPerInstitution<T extends { handle: { institutionRefHash: string }; observedAt: string }>(
  records: ReadonlyArray<T>,
): T[] {
  const byInstitution = new Map<string, T>();
  for (const r of records) {
    const key = r.handle.institutionRefHash;
    const existing = byInstitution.get(key);
    if (!existing || r.observedAt > existing.observedAt) {
      byInstitution.set(key, r);
    }
  }
  return Array.from(byInstitution.values()).sort((a, b) =>
    a.handle.institutionRefHash.localeCompare(b.handle.institutionRefHash),
  );
}

function preprocess(inputs: AggregationInputs): AggregationInputs {
  return {
    trajectories: latestPerInstitution(inputs.trajectories),
    drifts: latestPerInstitution(inputs.drifts),
    stewardships: latestPerInstitution(inputs.stewardships),
    survivabilities: latestPerInstitution(inputs.survivabilities),
    debts: latestPerInstitution(inputs.debts),
  };
}

function maxBand<T extends string>(distribution: Readonly<Record<T, number>>): T {
  let maxKey = Object.keys(distribution)[0] as T;
  let maxVal = distribution[maxKey] ?? 0;
  const keys = Object.keys(distribution).sort() as T[];
  for (const key of keys) {
    const value = distribution[key] ?? 0;
    if (value > maxVal) {
      maxVal = value;
      maxKey = key;
    }
  }
  return maxKey;
}

function deriveStewardshipTheme(
  baseline: SectorBaselineEnvelope,
): StewardshipTransferTheme {
  if (!baseline.readable) return 'not_yet_readable';
  const dominant = maxBand(baseline.stewardshipDistribution);
  switch (dominant) {
    case 'redistributing':
      return 'distributed_stewardship_carry';
    case 'holding':
      return 'steady_stewardship_carry';
    case 'reconcentrating':
      return 'concentrated_stewardship_dependency';
    default:
      return 'not_yet_readable';
  }
}

function deriveOnboardingPattern(
  baseline: SectorBaselineEnvelope,
): OnboardingSurvivabilityPattern {
  if (!baseline.readable) return 'not_yet_readable';
  const dominant = maxBand(baseline.survivabilityDistribution);
  switch (dominant) {
    case 'strengthening':
      return 'survivability_strengthening';
    case 'holding':
      return 'survivability_holding';
    case 'weakening':
      return 'survivability_weakening';
    default:
      return 'not_yet_readable';
  }
}

function deriveModernizationFragilityArchetype(
  baseline: SectorBaselineEnvelope,
): ModernizationFragilityArchetype {
  if (!baseline.readable) return 'not_yet_readable';

  const debt = maxBand(baseline.debtDistribution);
  const drift = maxBand(baseline.driftDistribution);
  const survivability = maxBand(baseline.survivabilityDistribution);
  const stewardship = maxBand(baseline.stewardshipDistribution);
  const trajectory = maxBand(baseline.trajectoryDistribution);

  if (
    (debt === 'accumulating' || drift === 'regressing') &&
    survivability === 'weakening'
  ) {
    return 'brittle_transition';
  }

  if (stewardship === 'reconcentrating' && survivability === 'weakening') {
    return 'concentrated_stewardship_dependency';
  }

  if (survivability === 'weakening') {
    return 'onboarding_erosion';
  }

  if (
    (trajectory === 'stabilizing' || trajectory === 'holding') &&
    (drift === 'stabilizing' || drift === 'holding') &&
    (debt === 'reducing' || debt === 'holding')
  ) {
    return 'stable_modernization';
  }

  return 'transitional_variability';
}

function composeDoctrineSafeReportLines(
  observatory: Pick<
    SectorContinuityObservatory,
    | 'readable'
    | 'sector'
    | 'contributingInstitutions'
    | 'stewardshipTransferTheme'
    | 'onboardingSurvivabilityPattern'
    | 'modernizationFragilityArchetype'
  >,
): ReadonlyArray<string> {
  if (!observatory.readable) {
    return [
      `Sector observatory for ${observatory.sector} is withheld because the anonymized cohort is below the minimum readability floor.`,
      'No institution-level detail is returned under the refusal path.',
    ];
  }

  return [
    `Sector observatory covers ${observatory.contributingInstitutions} anonymized institutions in ${observatory.sector}.`,
    `Stewardship transfer theme: ${observatory.stewardshipTransferTheme}.`,
    `Onboarding survivability pattern: ${observatory.onboardingSurvivabilityPattern}.`,
    `Modernization fragility archetype: ${observatory.modernizationFragilityArchetype}.`,
    'This output is aggregation-only, low-cardinality, deterministic, and non-ranking.',
  ];
}

export interface ComposeSectorContinuityObservatoryInput {
  readonly sector: IntelligenceSector;
  readonly observatoryId: string;
  readonly composedAt: string;
  readonly records: AggregationInputs;
}

export function composeSectorContinuityObservatory(
  input: ComposeSectorContinuityObservatoryInput,
): SectorContinuityObservatory {
  const preprocessed = preprocess(input.records);
  const baseline = composeSectorBaseline(
    input.sector,
    `${input.observatoryId}:baseline`,
    input.composedAt,
    preprocessed,
  );

  const observatory: SectorContinuityObservatory = {
    observatoryId: input.observatoryId,
    sector: input.sector,
    composedAt: input.composedAt,
    readable: baseline.readable,
    contributingInstitutions: baseline.contributingInstitutions,
    baseline,
    continuityTrendAggregation: {
      trajectoryDistribution: baseline.trajectoryDistribution,
      driftDistribution: baseline.driftDistribution,
      debtDistribution: baseline.debtDistribution,
    },
    stewardshipTransferTheme: deriveStewardshipTheme(baseline),
    onboardingSurvivabilityPattern: deriveOnboardingPattern(baseline),
    modernizationFragilityArchetype: deriveModernizationFragilityArchetype(
      baseline,
    ),
    doctrineSafeReportLines: [],
  };

  return Object.freeze({
    ...observatory,
    doctrineSafeReportLines: Object.freeze(composeDoctrineSafeReportLines(observatory)),
  });
}

export interface ComposeMultiSectorObservatoryInput {
  readonly sectors: ReadonlyArray<IntelligenceSector>;
  readonly composedAt: string;
  readonly records: AggregationInputs;
  readonly observatoryIdPrefix?: string;
}

export function composeSectorContinuityObservatories(
  input: ComposeMultiSectorObservatoryInput,
): ReadonlyArray<SectorContinuityObservatory> {
  const prefix = input.observatoryIdPrefix ?? 'sector-observatory';
  return Object.freeze(
    [...new Set(input.sectors)]
      .sort()
      .map((sector) =>
        composeSectorContinuityObservatory({
          sector,
          composedAt: input.composedAt,
          observatoryId: `${prefix}:${sector}`,
          records: input.records,
        }),
      ),
  );
}
