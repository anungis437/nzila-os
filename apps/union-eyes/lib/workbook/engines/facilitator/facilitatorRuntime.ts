/**
 * ARTIFACT TYPE: Engine
 * MODULE: OCI Facilitator Runtime
 * DOCTRINE_VERSION: 2.0.0
 *
 * Facilitator runtime. Composition of pacing, sensitivity, and
 * readiness models into a single facilitator-facing surface.
 *
 * Emits ONLY institution-scoped categorical signals. NEVER emits
 * any person-level signal. NEVER scores defensiveness, readiness,
 * or any other trait of any individual.
 *
 * Pure, deterministic. Signals stably sorted by signalId.
 */

import { readFacilitationPacing, type PacingInput, type PacingReading } from './facilitationPacingModel';
import { readInterventionSensitivity, type SensitivityInput, type SensitivityReading } from './interventionSensitivityModel';
import { readStabilizationReadiness, type ReadinessInput, type ReadinessReading } from './stabilizationReadinessSignals';

export const ENGINE_VERSION = '2.0.0';

export type FacilitatorSignalSeverity = 'note' | 'observation' | 'warning' | 'critical';

export type FacilitatorSignalCategory =
  | 'facilitator_pacing_recommendation'
  | 'facilitator_sensitivity_flag'
  | 'facilitator_readiness_insufficient'
  | 'facilitator_overload_protection_engaged';

export interface FacilitatorSignal {
  readonly signalId: string;
  readonly severity: FacilitatorSignalSeverity;
  readonly category: FacilitatorSignalCategory;
  readonly statement: string;
  readonly evidence: Readonly<Record<string, unknown>>;
}

export interface FacilitatorRuntimeInput {
  readonly pacing: PacingInput;
  readonly sensitivity: SensitivityInput;
  readonly readiness: ReadinessInput;
}

export interface FacilitatorRuntimeResult {
  readonly engineVersion: typeof ENGINE_VERSION;
  readonly pacing: PacingReading;
  readonly sensitivity: SensitivityReading;
  readonly readiness: ReadinessReading;
  readonly signals: readonly FacilitatorSignal[];
}

export function runFacilitatorRuntime(input: FacilitatorRuntimeInput): FacilitatorRuntimeResult {
  const pacing = readFacilitationPacing(input.pacing);
  const sensitivity = readInterventionSensitivity(input.sensitivity);
  const readiness = readStabilizationReadiness(input.readiness);

  const signals: FacilitatorSignal[] = [];

  signals.push({
    signalId: 'facilitator:pacing',
    severity: pacing.pacing === 'defer' ? 'warning' : 'note',
    category: 'facilitator_pacing_recommendation',
    statement: pacing.statement,
    evidence: { pacing: pacing.pacing, overloadEngaged: pacing.overloadEngaged },
  });

  signals.push({
    signalId: 'facilitator:sensitivity',
    severity:
      sensitivity.register === 'high' ? 'warning' : sensitivity.register === 'elevated' ? 'observation' : 'note',
    category: 'facilitator_sensitivity_flag',
    statement: sensitivity.statement,
    evidence: { register: sensitivity.register },
  });

  if (!readiness.sufficient) {
    signals.push({
      signalId: 'facilitator:readiness_insufficient',
      severity: 'warning',
      category: 'facilitator_readiness_insufficient',
      statement: readiness.statement,
      evidence: { unmet: readiness.unmet },
    });
  }

  if (pacing.overloadEngaged) {
    signals.push({
      signalId: 'facilitator:overload_engaged',
      severity: 'warning',
      category: 'facilitator_overload_protection_engaged',
      statement: 'Active intervention count exceeds organizational bandwidth; pacing is held back.',
      evidence: { activeInterventionCount: input.pacing.activeInterventionCount },
    });
  }

  signals.sort((a, b) => a.signalId.localeCompare(b.signalId));

  return {
    engineVersion: ENGINE_VERSION,
    pacing,
    sensitivity,
    readiness,
    signals,
  };
}
