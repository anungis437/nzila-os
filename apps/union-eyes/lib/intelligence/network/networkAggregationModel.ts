/**
 * ARTIFACT TYPE: Aggregation Model
 * MODULE: OCI Intelligence Network
 * DOCTRINE_VERSION: 1.0.0
 *
 * Network aggregation model.
 *
 * This module composes sector baseline envelopes from longitudinal records.
 * Every aggregation runs the k-anonymity floor before returning a readable
 * envelope; cohorts below the floor receive `readable: false` envelopes that
 * carry only the sector and refusal marker.
 *
 * Posture:
 *   - Refusal-first. Below-floor cohorts return refusal envelopes.
 *   - Deterministic. Distribution maps are constructed from full enums so the
 *     shape is stable regardless of which bands appear in the input.
 *   - Anti-surveillance. Aggregation never returns per-institution detail.
 */

import {
  type ContinuityDebtEvolutionRecord,
  type ContinuityDebtTrend,
  type ContinuityTrajectoryBand,
  type ContinuityTrajectoryRecord,
  type GovernanceDriftBand,
  type GovernanceEntropyDriftRecord,
  type IntelligenceSector,
  type SectorBaselineEnvelope,
  type StewardshipEvolutionBand,
  type StewardshipEvolutionRecord,
  type SurvivabilityProgressionBand,
  type SurvivabilityProgressionRecord,
} from '../contracts/intelligenceContracts';
import { K_ANONYMITY_FLOOR } from '../ethics/intelligenceEthicsValidators';

export const NETWORK_AGGREGATION_VERSION = '1.0.0' as const;

const TRAJECTORY_BANDS: ReadonlyArray<ContinuityTrajectoryBand> = [
  'not_yet_readable',
  'holding',
  'stabilizing',
  'regressing',
];

const DRIFT_BANDS: ReadonlyArray<GovernanceDriftBand> = [
  'not_yet_readable',
  'stabilizing',
  'holding',
  'regressing',
];

const STEWARDSHIP_BANDS: ReadonlyArray<StewardshipEvolutionBand> = [
  'not_yet_readable',
  'redistributing',
  'holding',
  'reconcentrating',
];

const SURVIVABILITY_BANDS: ReadonlyArray<SurvivabilityProgressionBand> = [
  'not_yet_readable',
  'strengthening',
  'holding',
  'weakening',
];

const DEBT_TRENDS: ReadonlyArray<ContinuityDebtTrend> = [
  'not_yet_readable',
  'reducing',
  'holding',
  'accumulating',
];

function emptyDistribution<T extends string>(
  keys: ReadonlyArray<T>,
): Record<T, number> {
  const distribution = {} as Record<T, number>;
  for (const key of keys) {
    distribution[key] = 0;
  }
  return distribution;
}

function distinctInstitutions<T extends { handle: { institutionRefHash: string } }>(
  records: ReadonlyArray<T>,
): number {
  const set = new Set<string>();
  for (const record of records) {
    set.add(record.handle.institutionRefHash);
  }
  return set.size;
}

export interface AggregationInputs {
  readonly trajectories: ReadonlyArray<ContinuityTrajectoryRecord>;
  readonly drifts: ReadonlyArray<GovernanceEntropyDriftRecord>;
  readonly stewardships: ReadonlyArray<StewardshipEvolutionRecord>;
  readonly survivabilities: ReadonlyArray<SurvivabilityProgressionRecord>;
  readonly debts: ReadonlyArray<ContinuityDebtEvolutionRecord>;
}

/**
 * Composes a sector baseline envelope from longitudinal records. Returns a
 * refusal envelope (`readable: false`, zeroed distributions) if the cohort
 * size is below the k-anonymity floor.
 */
export function composeSectorBaseline(
  sector: IntelligenceSector,
  baselineId: string,
  composedAt: string,
  inputs: AggregationInputs,
): SectorBaselineEnvelope {
  // Filter inputs to the requested sector before counting cohort size so the
  // floor reflects sector membership, not total participation.
  const sectorTrajectories = inputs.trajectories.filter(
    (r) => r.handle.sector === sector,
  );
  const sectorDrifts = inputs.drifts.filter((r) => r.handle.sector === sector);
  const sectorStewardships = inputs.stewardships.filter(
    (r) => r.handle.sector === sector,
  );
  const sectorSurvivabilities = inputs.survivabilities.filter(
    (r) => r.handle.sector === sector,
  );
  const sectorDebts = inputs.debts.filter((r) => r.handle.sector === sector);

  const cohortSize = distinctInstitutions([
    ...sectorTrajectories,
    ...sectorDrifts,
    ...sectorStewardships,
    ...sectorSurvivabilities,
    ...sectorDebts,
  ]);

  const trajectoryDistribution = emptyDistribution(TRAJECTORY_BANDS);
  const driftDistribution = emptyDistribution(DRIFT_BANDS);
  const stewardshipDistribution = emptyDistribution(STEWARDSHIP_BANDS);
  const survivabilityDistribution = emptyDistribution(SURVIVABILITY_BANDS);
  const debtDistribution = emptyDistribution(DEBT_TRENDS);

  if (cohortSize < K_ANONYMITY_FLOOR) {
    return {
      baselineId,
      sector,
      composedAt,
      contributingInstitutions: cohortSize,
      trajectoryDistribution,
      driftDistribution,
      stewardshipDistribution,
      survivabilityDistribution,
      debtDistribution,
      readable: false,
    };
  }

  for (const record of sectorTrajectories) {
    trajectoryDistribution[record.band] += 1;
  }
  for (const record of sectorDrifts) {
    driftDistribution[record.drift] += 1;
  }
  for (const record of sectorStewardships) {
    stewardshipDistribution[record.evolution] += 1;
  }
  for (const record of sectorSurvivabilities) {
    survivabilityDistribution[record.progression] += 1;
  }
  for (const record of sectorDebts) {
    debtDistribution[record.trend] += 1;
  }

  return {
    baselineId,
    sector,
    composedAt,
    contributingInstitutions: cohortSize,
    trajectoryDistribution,
    driftDistribution,
    stewardshipDistribution,
    survivabilityDistribution,
    debtDistribution,
    readable: true,
  };
}
