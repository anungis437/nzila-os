/**
 * ARTIFACT TYPE: Longitudinal Engine
 * MODULE: OCI Intelligence Network
 * DOCTRINE_VERSION: 1.0.0
 *
 * Longitudinal Continuity Intelligence™ engine.
 *
 * Composes a reviewer-readable longitudinal reading across the eight required
 * longitudinal domains for a single institution:
 *
 *   - Continuity Maturity Evolution
 *   - Governance Entropy Drift
 *   - Stewardship Redistribution Evolution
 *   - Onboarding Survivability Progression
 *   - Continuity Debt Reduction
 *   - Institutional Resilience Trajectory
 *   - Runtime Stabilization Persistence
 *   - Modernization Survivability Evolution
 *
 * Every domain refuses without at least two readings. The engine never
 * extrapolates. The reading is intentionally minimal: it is a structured
 * reflection, not a forecast.
 */

import type {
  ContinuityDebtEvolutionRecord,
  ContinuityDebtTrend,
  ContinuityTrajectoryBand,
  ContinuityTrajectoryRecord,
  GovernanceDriftBand,
  GovernanceEntropyDriftRecord,
  StewardshipEvolutionBand,
  StewardshipEvolutionRecord,
  SurvivabilityProgressionBand,
  SurvivabilityProgressionRecord,
} from '../contracts/intelligenceContracts';
import { composeContinuityEvolutionTimeline } from './continuityEvolutionTimeline';
import {
  readResilienceTrajectory,
  type ResilienceTrajectoryReading,
} from './resilienceTrajectoryEngine';

export const LONGITUDINAL_CONTINUITY_VERSION = '1.0.0' as const;

export interface LongitudinalReadingInputs {
  readonly institutionRefHash: string;
  readonly trajectories: ReadonlyArray<ContinuityTrajectoryRecord>;
  readonly drifts: ReadonlyArray<GovernanceEntropyDriftRecord>;
  readonly stewardships: ReadonlyArray<StewardshipEvolutionRecord>;
  readonly survivabilities: ReadonlyArray<SurvivabilityProgressionRecord>;
  readonly debts: ReadonlyArray<ContinuityDebtEvolutionRecord>;
  /**
   * Optional separate runtime stabilization persistence readings expressed as
   * trajectory records. Many institutions reuse trajectory records here.
   */
  readonly runtimeStabilization?: ReadonlyArray<ContinuityTrajectoryRecord>;
  /**
   * Optional separate modernization survivability readings expressed as
   * survivability progression records.
   */
  readonly modernizationSurvivability?: ReadonlyArray<SurvivabilityProgressionRecord>;
}

export interface LongitudinalReading {
  readonly institutionRefHash: string;
  readonly maturityEvolution: ContinuityTrajectoryBand;
  readonly governanceDrift: GovernanceDriftBand;
  readonly stewardshipEvolution: StewardshipEvolutionBand;
  readonly onboardingSurvivability: SurvivabilityProgressionBand;
  readonly continuityDebtTrend: ContinuityDebtTrend;
  readonly resilienceTrajectory: ResilienceTrajectoryReading;
  readonly runtimeStabilizationPersistence: ContinuityTrajectoryBand;
  readonly modernizationSurvivability: SurvivabilityProgressionBand;
}

function lastBand<T, B extends string>(
  records: ReadonlyArray<T>,
  pickAt: (r: T) => string,
  pickBand: (r: T) => B,
  filterHash: (r: T) => string,
  institutionRefHash: string,
  refusal: B,
): B {
  const filtered = records.filter((r) => filterHash(r) === institutionRefHash);
  if (filtered.length < 2) return refusal;
  const sorted = [...filtered].sort((a, b) => pickAt(a).localeCompare(pickAt(b)));
  return pickBand(sorted[sorted.length - 1]!);
}

/**
 * Composes the full longitudinal reading for a single institution.
 */
export function readLongitudinalContinuity(
  inputs: LongitudinalReadingInputs,
): LongitudinalReading {
  const { institutionRefHash } = inputs;

  const maturityEvolution = lastBand(
    inputs.trajectories,
    (r) => r.observedAt,
    (r) => r.band,
    (r) => r.handle.institutionRefHash,
    institutionRefHash,
    'not_yet_readable',
  );

  const governanceDrift = lastBand(
    inputs.drifts,
    (r) => r.observedAt,
    (r) => r.drift,
    (r) => r.handle.institutionRefHash,
    institutionRefHash,
    'not_yet_readable',
  );

  const stewardshipEvolution = lastBand(
    inputs.stewardships,
    (r) => r.observedAt,
    (r) => r.evolution,
    (r) => r.handle.institutionRefHash,
    institutionRefHash,
    'not_yet_readable',
  );

  const onboardingSurvivability = lastBand(
    inputs.survivabilities,
    (r) => r.observedAt,
    (r) => r.progression,
    (r) => r.handle.institutionRefHash,
    institutionRefHash,
    'not_yet_readable',
  );

  const continuityDebtTrend = lastBand(
    inputs.debts,
    (r) => r.observedAt,
    (r) => r.trend,
    (r) => r.handle.institutionRefHash,
    institutionRefHash,
    'not_yet_readable',
  );

  const timeline = composeContinuityEvolutionTimeline(
    institutionRefHash,
    inputs.trajectories,
  );
  const resilienceTrajectory = readResilienceTrajectory(timeline);

  const runtimeStabilizationPersistence = lastBand(
    inputs.runtimeStabilization ?? inputs.trajectories,
    (r) => r.observedAt,
    (r) => r.band,
    (r) => r.handle.institutionRefHash,
    institutionRefHash,
    'not_yet_readable',
  );

  const modernizationSurvivability = lastBand(
    inputs.modernizationSurvivability ?? inputs.survivabilities,
    (r) => r.observedAt,
    (r) => r.progression,
    (r) => r.handle.institutionRefHash,
    institutionRefHash,
    'not_yet_readable',
  );

  return {
    institutionRefHash,
    maturityEvolution,
    governanceDrift,
    stewardshipEvolution,
    onboardingSurvivability,
    continuityDebtTrend,
    resilienceTrajectory,
    runtimeStabilizationPersistence,
    modernizationSurvivability,
  };
}
