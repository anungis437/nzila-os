/**
 * ARTIFACT TYPE: Runtime Engine
 * MODULE: OCI Onboarding Runtime
 * DOCTRINE_VERSION: 1.0.0
 *
 * The Continuity Transfer Runtime reads stewardship transfer records and
 * composes a refusable observation about the continuity carried by the
 * transfer. Transfers are operational events; the runtime only reads what
 * a reviewer has recorded.
 *
 * Posture:
 *   - Refusal-first: missing transfers → not_yet_readable.
 *   - Deterministic.
 *   - No personal identifiers; only reviewer/steward refIds.
 */

import type {
  ContinuityRuntimeBand,
  RuntimeContinuitySignal,
  StewardshipTransferRecord,
} from '../contracts/runtimeContracts';
import { RUNTIME_CONTRACT_VERSION } from '../contracts/runtimeContracts';

export const CONTINUITY_TRANSFER_RUNTIME_VERSION = '1.0.0' as const;

export interface TransferContinuityReading {
  readonly engineVersion: typeof CONTINUITY_TRANSFER_RUNTIME_VERSION;
  readonly institutionScope: string;
  readonly transfersObserved: number;
  readonly continuityCarriedBand: ContinuityRuntimeBand;
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

export function readTransferContinuity(
  transfers: readonly StewardshipTransferRecord[],
  institutionScope: string,
): TransferContinuityReading {
  const bands = transfers.map((t) => t.continuityCarriedBand);
  const continuityCarriedBand = weakestBand(bands);

  const signals: RuntimeContinuitySignal[] = [];
  if (transfers.length === 0) {
    signals.push({
      contractVersion: RUNTIME_CONTRACT_VERSION,
      signalId: 'continuity_transfer:not_yet_readable',
      severity: 'note',
      category: 'continuity_transfer_not_yet_readable',
      statement: 'No stewardship transfer records observed for this institution scope.',
      evidence: { institutionScope },
    });
  } else {
    signals.push({
      contractVersion: RUNTIME_CONTRACT_VERSION,
      signalId: 'continuity_transfer:band',
      severity: continuityCarriedBand === 'regressing' ? 'warning' : 'observation',
      category: 'continuity_transfer_band',
      statement: `Continuity carried across transfers presents as ${continuityCarriedBand}.`,
      evidence: { continuityCarriedBand, transfersObserved: transfers.length },
    });
  }
  signals.sort((a, b) => a.signalId.localeCompare(b.signalId));

  return {
    engineVersion: CONTINUITY_TRANSFER_RUNTIME_VERSION,
    institutionScope,
    transfersObserved: transfers.length,
    continuityCarriedBand,
    signals,
    statement:
      transfers.length === 0
        ? 'Continuity carried across stewardship transfers is not yet readable.'
        : `Continuity carried across stewardship transfers presents as ${continuityCarriedBand}.`,
  };
}
