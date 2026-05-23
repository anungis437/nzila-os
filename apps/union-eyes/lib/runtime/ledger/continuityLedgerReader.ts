/**
 * ARTIFACT TYPE: Runtime Reader
 * MODULE: OCI Continuity Ledger
 * DOCTRINE_VERSION: 1.0.0
 *
 * Refusable reader that composes a human-readable summary of the institution's
 * continuity ledger for an executive reading. The reader never aggregates
 * across institutions and never returns counts without authorisation.
 */

import type { RuntimeContinuitySignal } from '../contracts/runtimeContracts';
import { RUNTIME_CONTRACT_VERSION } from '../contracts/runtimeContracts';
import type {
  LedgerEntryKind,
  LedgerReadOptions,
  LedgerReader,
} from './continuityLedgerContracts';

export const CONTINUITY_LEDGER_READER_VERSION = '1.0.0' as const;

export interface LedgerSummary {
  readonly engineVersion: typeof CONTINUITY_LEDGER_READER_VERSION;
  readonly institutionScope: string;
  readonly totalEntries: number;
  readonly perKind: Readonly<Record<LedgerEntryKind, number>>;
  readonly oldestStatedAt: string | null;
  readonly newestStatedAt: string | null;
  readonly signals: readonly RuntimeContinuitySignal[];
  readonly statement: string;
}

const LEDGER_KINDS: readonly LedgerEntryKind[] = [
  'governance_lineage',
  'operational_continuity_reference',
  'continuity_transition',
  'stewardship_redistribution_lineage',
  'onboarding_survivability_evolution',
  'runtime_continuity_state_history',
];

export function readLedgerSummary(
  reader: LedgerReader,
  options: LedgerReadOptions,
): LedgerSummary {
  const entries = reader.listEntries(options);
  const perKindAcc: Record<LedgerEntryKind, number> = {
    governance_lineage: 0,
    operational_continuity_reference: 0,
    continuity_transition: 0,
    stewardship_redistribution_lineage: 0,
    onboarding_survivability_evolution: 0,
    runtime_continuity_state_history: 0,
  };
  for (const e of entries) perKindAcc[e.entryKind] += 1;

  const signals: RuntimeContinuitySignal[] = [];
  if (entries.length === 0) {
    signals.push({
      contractVersion: RUNTIME_CONTRACT_VERSION,
      signalId: 'continuity_ledger:not_yet_readable',
      severity: 'note',
      category: 'continuity_ledger_not_yet_readable',
      statement: 'The continuity ledger holds no entries for this institution scope.',
      evidence: { institutionScope: options.institutionScope },
    });
  } else {
    signals.push({
      contractVersion: RUNTIME_CONTRACT_VERSION,
      signalId: 'continuity_ledger:summary',
      severity: 'observation',
      category: 'continuity_ledger_summary',
      statement: `Continuity ledger holds ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}.`,
      evidence: { entryCount: entries.length, perKind: perKindAcc },
    });
    for (const k of LEDGER_KINDS) {
      if (perKindAcc[k] > 0) {
        signals.push({
          contractVersion: RUNTIME_CONTRACT_VERSION,
          signalId: `continuity_ledger:kind:${k}`,
          severity: 'note',
          category: 'continuity_ledger_kind',
          statement: `Ledger entries of kind ${k}: ${perKindAcc[k]}.`,
          evidence: { kind: k, count: perKindAcc[k] },
        });
      }
    }
  }
  signals.sort((a, b) => a.signalId.localeCompare(b.signalId));

  return {
    engineVersion: CONTINUITY_LEDGER_READER_VERSION,
    institutionScope: options.institutionScope,
    totalEntries: entries.length,
    perKind: perKindAcc,
    oldestStatedAt: entries[0]?.statedAt ?? null,
    newestStatedAt: entries[entries.length - 1]?.statedAt ?? null,
    signals,
    statement:
      entries.length === 0
        ? 'The continuity ledger is not yet readable for this institution scope.'
        : `The continuity ledger preserves ${entries.length} organizational entr${entries.length === 1 ? 'y' : 'ies'}.`,
  };
}
