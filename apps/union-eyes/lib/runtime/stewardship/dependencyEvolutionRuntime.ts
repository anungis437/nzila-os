/**
 * ARTIFACT TYPE: Runtime Engine
 * MODULE: OCI Runtime Stewardship
 * DOCTRINE_VERSION: 1.0.0
 *
 * Dependency Evolution Runtime.
 *
 * Reads a sequence of dependency observations (each describing how reliant an
 * institutional function is on a single steward or system) and composes a
 * refusable observation about how that dependency has moved over time.
 *
 * Posture:
 *   - Refusal-first: empty inputs → not_yet_readable.
 *   - Deterministic.
 *   - Reports institutional readings only; never about individuals.
 */

import type {
  ContinuityRuntimeBand,
  RuntimeContinuitySignal,
} from '../contracts/runtimeContracts';
import { RUNTIME_CONTRACT_VERSION } from '../contracts/runtimeContracts';

export const DEPENDENCY_EVOLUTION_RUNTIME_VERSION = '1.0.0' as const;

export interface DependencyObservation {
  readonly institutionScope: string;
  readonly functionRefId: string;
  readonly singlePointDependencyCount: number;
  readonly statedAt: string;
}

export interface DependencyEvolutionReading {
  readonly engineVersion: typeof DEPENDENCY_EVOLUTION_RUNTIME_VERSION;
  readonly institutionScope: string;
  readonly observationsConsidered: number;
  readonly oldestStatedAt: string | null;
  readonly newestStatedAt: string | null;
  readonly evolutionBand: ContinuityRuntimeBand;
  readonly signals: readonly RuntimeContinuitySignal[];
  readonly statement: string;
}

export function readDependencyEvolution(
  observations: readonly DependencyObservation[],
  institutionScope: string,
): DependencyEvolutionReading {
  const scoped = [...observations.filter((o) => o.institutionScope === institutionScope)].sort(
    (a, b) => a.statedAt.localeCompare(b.statedAt),
  );

  let evolutionBand: ContinuityRuntimeBand;
  if (scoped.length === 0) {
    evolutionBand = 'not_yet_readable';
  } else if (scoped.length === 1) {
    evolutionBand = 'not_yet_readable';
  } else {
    const first = scoped[0].singlePointDependencyCount;
    const last = scoped[scoped.length - 1].singlePointDependencyCount;
    if (last < first) evolutionBand = 'stabilizing';
    else if (last === first) evolutionBand = 'holding';
    else evolutionBand = 'regressing';
  }

  const signals: RuntimeContinuitySignal[] = [];
  if (scoped.length === 0) {
    signals.push({
      contractVersion: RUNTIME_CONTRACT_VERSION,
      signalId: 'dependency_evolution:not_yet_readable',
      severity: 'note',
      category: 'dependency_evolution_not_yet_readable',
      statement: 'No dependency observations available for this institution scope.',
      evidence: { institutionScope },
    });
  } else {
    signals.push({
      contractVersion: RUNTIME_CONTRACT_VERSION,
      signalId: 'dependency_evolution:band',
      severity: evolutionBand === 'regressing' ? 'warning' : 'observation',
      category: 'dependency_evolution_band',
      statement: `Operational dependency evolution presents as ${evolutionBand}.`,
      evidence: { evolutionBand, observationsConsidered: scoped.length },
    });
  }
  signals.sort((a, b) => a.signalId.localeCompare(b.signalId));

  return {
    engineVersion: DEPENDENCY_EVOLUTION_RUNTIME_VERSION,
    institutionScope,
    observationsConsidered: scoped.length,
    oldestStatedAt: scoped[0]?.statedAt ?? null,
    newestStatedAt: scoped[scoped.length - 1]?.statedAt ?? null,
    evolutionBand,
    signals,
    statement:
      scoped.length === 0
        ? 'Operational dependency evolution is not yet readable for this institution scope.'
        : `Operational dependency evolution presents as ${evolutionBand} on the available reading.`,
  };
}
