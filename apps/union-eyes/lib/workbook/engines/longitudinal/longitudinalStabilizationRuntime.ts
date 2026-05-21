/**
 * ARTIFACT TYPE: Engine
 * MODULE: OCI Longitudinal Stabilization
 * DOCTRINE_VERSION: 2.0.0
 *
 * Longitudinal stabilization runtime. Composes evolution direction,
 * maturity placement, and intervention ledger reductions into a
 * single longitudinal envelope under k-anonymity floor discipline.
 *
 * Pure, deterministic.
 */

import type { StabilizationEvolutionReading } from '../progression/stabilizationEvolutionModel';
import type { MaturityProgressionReading } from '../progression/continuityMaturityProgression';

export const ENGINE_VERSION = '2.0.0';

export interface LongitudinalRuntimeInput {
  readonly evolution: StabilizationEvolutionReading;
  readonly maturity: MaturityProgressionReading;
  readonly ledger: {
    readonly totalInterventionEvents: number;
    readonly distinctWorkflowParticipations: number;
    readonly irreversiblyRatifiedCount: number;
    readonly regressedCount: number;
  };
  readonly kAnonymityFloor?: number;
}

export interface LongitudinalRuntimeResult {
  readonly engineVersion: typeof ENGINE_VERSION;
  readonly kFloorMet: boolean;
  readonly contributingInputs: readonly ('evolution' | 'maturity' | 'ledger')[];
  readonly evolutionDirection: StabilizationEvolutionReading['direction'];
  readonly maturityCurrentStage: MaturityProgressionReading['currentStage'];
  readonly ledgerDirection: 'unknown' | 'improving' | 'holding' | 'regressing';
  readonly statement: string;
}

const DEFAULT_K = 5;

export function runLongitudinalStabilizationRuntime(
  input: LongitudinalRuntimeInput,
): LongitudinalRuntimeResult {
  const k = input.kAnonymityFloor ?? DEFAULT_K;
  const kFloorMet =
    input.ledger.totalInterventionEvents >= k && input.ledger.distinctWorkflowParticipations >= k;

  const ledgerDirection = ledgerClassify(input.ledger);

  const contributingInputs: ('evolution' | 'maturity' | 'ledger')[] = [];
  if (input.evolution.direction !== 'unknown') contributingInputs.push('evolution');
  if (input.maturity.currentStage !== 'unknown') contributingInputs.push('maturity');
  if (ledgerDirection !== 'unknown') contributingInputs.push('ledger');

  return {
    engineVersion: ENGINE_VERSION,
    kFloorMet,
    contributingInputs,
    evolutionDirection: input.evolution.direction,
    maturityCurrentStage: input.maturity.currentStage,
    ledgerDirection,
    statement: kFloorMet
      ? `Longitudinal envelope is composed from ${contributingInputs.length} contributing input(s); k-anonymity floor is met.`
      : `Longitudinal envelope is withheld; k-anonymity floor (k=${k}) is not met.`,
  };
}

function ledgerClassify(
  l: LongitudinalRuntimeInput['ledger'],
): 'unknown' | 'improving' | 'holding' | 'regressing' {
  const total = l.irreversiblyRatifiedCount + l.regressedCount;
  if (total === 0) return 'unknown';
  if (l.regressedCount > l.irreversiblyRatifiedCount) return 'regressing';
  if (l.irreversiblyRatifiedCount > 0 && l.regressedCount === 0) return 'improving';
  return 'holding';
}
