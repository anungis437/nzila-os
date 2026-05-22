/**
 * ARTIFACT TYPE: Runtime Engine
 * MODULE: OCI Onboarding Runtime
 * DOCTRINE_VERSION: 1.0.0
 *
 * The Onboarding Runtime reads the survivability contribution of onboarding
 * workflows. Onboarding workflows are operational artefacts; the runtime
 * does not author them, run them, or score the people inside them.
 *
 * Posture:
 *   - Refusal-first: if no records, the survivability is `not_yet_readable`.
 *   - Deterministic.
 *   - Reviewer-led: every read is institution-scoped.
 */

import type {
  ContinuityRuntimeBand,
  OnboardingSurvivabilityRecord,
  RuntimeContinuitySignal,
} from '../contracts/runtimeContracts';
import { RUNTIME_CONTRACT_VERSION } from '../contracts/runtimeContracts';

export const ONBOARDING_RUNTIME_VERSION = '1.0.0' as const;

export interface OnboardingSurvivabilityReading {
  readonly engineVersion: typeof ONBOARDING_RUNTIME_VERSION;
  readonly institutionScope: string;
  readonly recordsObserved: number;
  readonly contextPreservedBand: ContinuityRuntimeBand;
  readonly reconstructionBurdenBand: ContinuityRuntimeBand;
  readonly survivabilityBand: ContinuityRuntimeBand;
  readonly signals: readonly RuntimeContinuitySignal[];
  readonly statement: string;
}

function weakestBand(bands: readonly ContinuityRuntimeBand[]): ContinuityRuntimeBand {
  const order: Readonly<Record<ContinuityRuntimeBand, number>> = {
    regressing: 0,
    not_yet_readable: 1,
    stabilizing: 2,
    holding: 3,
  };
  if (bands.length === 0) return 'not_yet_readable';
  let weakest: ContinuityRuntimeBand = 'holding';
  for (const b of bands) if (order[b] < order[weakest]) weakest = b;
  return weakest;
}

export function readOnboardingSurvivability(
  records: readonly OnboardingSurvivabilityRecord[],
  institutionScope: string,
): OnboardingSurvivabilityReading {
  const contextBands = records.map((r) => r.contextPreservedBand);
  const burdenBands = records.map((r) => r.reconstructionBurdenBand);
  const contextPreservedBand = weakestBand(contextBands);
  const reconstructionBurdenBand = weakestBand(burdenBands);
  const survivabilityBand =
    records.length === 0
      ? 'not_yet_readable'
      : weakestBand([contextPreservedBand, reconstructionBurdenBand]);

  const signals: RuntimeContinuitySignal[] = [];
  if (records.length === 0) {
    signals.push({
      contractVersion: RUNTIME_CONTRACT_VERSION,
      signalId: 'onboarding_runtime:not_yet_readable',
      severity: 'note',
      category: 'onboarding_survivability_not_yet_readable',
      statement: 'No onboarding survivability records observed for this institution scope.',
      evidence: { institutionScope },
    });
  } else {
    signals.push({
      contractVersion: RUNTIME_CONTRACT_VERSION,
      signalId: 'onboarding_runtime:survivability_band',
      severity: survivabilityBand === 'regressing' ? 'warning' : 'observation',
      category: 'onboarding_survivability_band',
      statement: `Onboarding survivability band: ${survivabilityBand}.`,
      evidence: {
        survivabilityBand,
        contextPreservedBand,
        reconstructionBurdenBand,
        recordsObserved: records.length,
      },
    });
  }
  signals.sort((a, b) => a.signalId.localeCompare(b.signalId));

  return {
    engineVersion: ONBOARDING_RUNTIME_VERSION,
    institutionScope,
    recordsObserved: records.length,
    contextPreservedBand,
    reconstructionBurdenBand,
    survivabilityBand,
    signals,
    statement:
      records.length === 0
        ? 'Onboarding survivability is not yet readable for this institution scope.'
        : `Onboarding survivability presents as ${survivabilityBand} on the available reading.`,
  };
}
