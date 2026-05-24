/**
 * ARTIFACT TYPE: Runtime Engine
 * MODULE: OCI Runtime Stewardship
 * DOCTRINE_VERSION: 1.0.0
 *
 * The Runtime Stewardship Engine reads stewardship transfer records over time
 * and composes a refusable observation about organizational stewardship
 * concentration.
 *
 * Posture:
 *   - Refusal-first: empty inputs → not_yet_readable.
 *   - Reports role-state movement; never names individuals.
 *   - Deterministic.
 */

import type {
  ContinuityRuntimeBand,
  RuntimeContinuitySignal,
  StewardshipTransferRecord,
} from '../contracts/runtimeContracts';
import { RUNTIME_CONTRACT_VERSION } from '../contracts/runtimeContracts';

export const RUNTIME_STEWARDSHIP_ENGINE_VERSION = '1.0.0' as const;

export interface StewardshipConcentrationReading {
  readonly engineVersion: typeof RUNTIME_STEWARDSHIP_ENGINE_VERSION;
  readonly institutionScope: string;
  readonly transfersObserved: number;
  readonly distinctOriginRoleStates: number;
  readonly distinctDestinationRoleStates: number;
  readonly reversibleTransfers: number;
  readonly consentRecordedTransfers: number;
  readonly concentrationBand: ContinuityRuntimeBand;
  readonly signals: readonly RuntimeContinuitySignal[];
  readonly statement: string;
}

export function readStewardshipConcentration(
  transfers: readonly StewardshipTransferRecord[],
  institutionScope: string,
): StewardshipConcentrationReading {
  const scoped = transfers.filter((t) => t.institutionScope === institutionScope);
  const distinctOriginRoleStates = new Set(scoped.map((t) => t.originRoleState)).size;
  const distinctDestinationRoleStates = new Set(scoped.map((t) => t.destinationRoleState)).size;
  const reversibleTransfers = scoped.filter((t) => !t.reversibilityWindowClosed).length;
  const consentRecordedTransfers = scoped.filter((t) => t.consentRecorded).length;

  let concentrationBand: ContinuityRuntimeBand;
  if (scoped.length === 0) {
    concentrationBand = 'not_yet_readable';
  } else if (
    distinctDestinationRoleStates === 1 ||
    consentRecordedTransfers < scoped.length
  ) {
    concentrationBand = 'regressing';
  } else if (distinctDestinationRoleStates >= 3 && reversibleTransfers > 0) {
    concentrationBand = 'holding';
  } else {
    concentrationBand = 'stabilizing';
  }

  const signals: RuntimeContinuitySignal[] = [];
  if (scoped.length === 0) {
    signals.push({
      contractVersion: RUNTIME_CONTRACT_VERSION,
      signalId: 'runtime_stewardship:not_yet_readable',
      severity: 'note',
      category: 'runtime_stewardship_not_yet_readable',
      statement: 'No stewardship transfers observed for this institution scope.',
      evidence: { institutionScope },
    });
  } else {
    signals.push({
      contractVersion: RUNTIME_CONTRACT_VERSION,
      signalId: 'runtime_stewardship:concentration_band',
      severity: concentrationBand === 'regressing' ? 'warning' : 'observation',
      category: 'runtime_stewardship_concentration_band',
      statement: `Stewardship concentration band: ${concentrationBand}.`,
      evidence: {
        concentrationBand,
        distinctDestinationRoleStates,
        reversibleTransfers,
        consentRecordedTransfers,
        transfersObserved: scoped.length,
      },
    });
  }
  signals.sort((a, b) => a.signalId.localeCompare(b.signalId));

  return {
    engineVersion: RUNTIME_STEWARDSHIP_ENGINE_VERSION,
    institutionScope,
    transfersObserved: scoped.length,
    distinctOriginRoleStates,
    distinctDestinationRoleStates,
    reversibleTransfers,
    consentRecordedTransfers,
    concentrationBand,
    signals,
    statement:
      scoped.length === 0
        ? 'Stewardship concentration is not yet readable for this institution scope.'
        : `Stewardship concentration presents as ${concentrationBand} on the available reading.`,
  };
}
