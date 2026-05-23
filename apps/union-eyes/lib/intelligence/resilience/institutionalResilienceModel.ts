/**
 * ARTIFACT TYPE: Organizational Resilience Model
 * MODULE: OCI Intelligence Network
 * DOCTRINE_VERSION: 1.0.0
 *
 * Organizational Resilience Trajectory™ model.
 *
 * Combines several reviewer-readable trajectories into a single resilience
 * reading describing how the institution's continuity has held up. The model
 * is deliberately conservative: it refuses to read resilience unless at least
 * two of the contributing trajectories are themselves readable.
 *
 * Resilience capabilities tracked (per Part 4 spec):
 *   - continuity stabilization persistence
 *   - governance recovery sustainability
 *   - onboarding survivability durability
 *   - stewardship redistribution durability
 *   - modernization continuity retention
 *   - organizational coherence resilience
 *
 * Each capability is a band; the overall resilience reading is the weakest of
 * the readable capabilities.
 */

import type {
  ContinuityTrajectoryBand,
  GovernanceDriftBand,
  InstitutionalResilienceBand,
  InstitutionalResilienceSignal,
  StewardshipEvolutionBand,
  SurvivabilityProgressionBand,
} from '../contracts/intelligenceContracts';

export const INSTITUTIONAL_RESILIENCE_MODEL_VERSION = '1.0.0' as const;

export interface ResilienceCapabilityInputs {
  readonly continuityStabilizationPersistence: ContinuityTrajectoryBand;
  readonly governanceRecoverySustainability: GovernanceDriftBand;
  readonly onboardingSurvivabilityDurability: SurvivabilityProgressionBand;
  readonly stewardshipRedistributionDurability: StewardshipEvolutionBand;
  readonly modernizationContinuityRetention: SurvivabilityProgressionBand;
  readonly institutionalCoherenceResilience: ContinuityTrajectoryBand;
}

export interface InstitutionalResilienceReading {
  readonly institutionRefHash: string;
  readonly band: InstitutionalResilienceBand;
  readonly signals: ReadonlyArray<InstitutionalResilienceSignal>;
  readonly basedOn: number;
}

const RESILIENCE_RANK: Readonly<Record<InstitutionalResilienceBand, number>> = {
  not_yet_readable: -1,
  eroding: 0,
  holding: 1,
  persisting: 2,
};

function trajectoryToResilience(band: ContinuityTrajectoryBand): InstitutionalResilienceBand {
  switch (band) {
    case 'regressing':
      return 'eroding';
    case 'holding':
      return 'holding';
    case 'stabilizing':
      return 'persisting';
    default:
      return 'not_yet_readable';
  }
}

function driftToResilience(band: GovernanceDriftBand): InstitutionalResilienceBand {
  switch (band) {
    case 'regressing':
      return 'eroding';
    case 'holding':
      return 'holding';
    case 'stabilizing':
      return 'persisting';
    default:
      return 'not_yet_readable';
  }
}

function survivabilityToResilience(
  band: SurvivabilityProgressionBand,
): InstitutionalResilienceBand {
  switch (band) {
    case 'weakening':
      return 'eroding';
    case 'holding':
      return 'holding';
    case 'strengthening':
      return 'persisting';
    default:
      return 'not_yet_readable';
  }
}

function stewardshipToResilience(
  band: StewardshipEvolutionBand,
): InstitutionalResilienceBand {
  switch (band) {
    case 'reconcentrating':
      return 'eroding';
    case 'holding':
      return 'holding';
    case 'redistributing':
      return 'persisting';
    default:
      return 'not_yet_readable';
  }
}

export interface InstitutionalResilienceComposition {
  readonly institutionRefHash: string;
  readonly capabilities: ResilienceCapabilityInputs;
  readonly reviewerSignals: ReadonlyArray<InstitutionalResilienceSignal>;
}

export function readInstitutionalResilience(
  composition: InstitutionalResilienceComposition,
): InstitutionalResilienceReading {
  const capabilityBands: InstitutionalResilienceBand[] = [
    trajectoryToResilience(composition.capabilities.continuityStabilizationPersistence),
    driftToResilience(composition.capabilities.governanceRecoverySustainability),
    survivabilityToResilience(composition.capabilities.onboardingSurvivabilityDurability),
    stewardshipToResilience(composition.capabilities.stewardshipRedistributionDurability),
    survivabilityToResilience(composition.capabilities.modernizationContinuityRetention),
    trajectoryToResilience(composition.capabilities.institutionalCoherenceResilience),
  ];

  const readable = capabilityBands.filter((b) => b !== 'not_yet_readable');
  if (readable.length < 2) {
    return {
      institutionRefHash: composition.institutionRefHash,
      band: 'not_yet_readable',
      signals: [...composition.reviewerSignals].sort((a, b) =>
        a.signalId.localeCompare(b.signalId),
      ),
      basedOn: readable.length,
    };
  }

  // Overall band is the weakest of the readable capabilities.
  const overall = readable.reduce<InstitutionalResilienceBand>(
    (worst, current) =>
      RESILIENCE_RANK[current] < RESILIENCE_RANK[worst] ? current : worst,
    readable[0]!,
  );

  return {
    institutionRefHash: composition.institutionRefHash,
    band: overall,
    signals: [...composition.reviewerSignals].sort((a, b) =>
      a.signalId.localeCompare(b.signalId),
    ),
    basedOn: readable.length,
  };
}
