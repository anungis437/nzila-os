/**
 * ARTIFACT TYPE: Runtime Contract
 * MODULE: OCI Continuity Ledger
 * DOCTRINE_VERSION: 1.0.0
 *
 * Contracts for the Runtime Continuity Ledger™.
 *
 * The ledger is organizational continuity persistence — NOT blockchain, NOT
 * immutable-hype architecture, NOT audit-theatre, NOT crypto logic.
 *
 * Entries are append-only in the composition surface. Superseding entries
 * carry a lineage reference back to the entry they supersede.
 */

import type {
  ContinuityEventEnvelope,
  GovernanceMemoryReference,
  RuntimeLineageReference,
} from '../contracts/runtimeContracts';

export const CONTINUITY_LEDGER_VERSION = '1.0.0' as const;

export type LedgerEntryKind =
  | 'governance_lineage'
  | 'operational_continuity_reference'
  | 'continuity_transition'
  | 'stewardship_redistribution_lineage'
  | 'onboarding_survivability_evolution'
  | 'runtime_continuity_state_history';

export interface ContinuityLedgerEntry {
  readonly ledgerVersion: typeof CONTINUITY_LEDGER_VERSION;
  readonly entryId: string;
  readonly entryKind: LedgerEntryKind;
  readonly institutionScope: string;
  readonly statedAt: string; // ISO-8601
  readonly statement: string;
  readonly lineage: readonly RuntimeLineageReference[];
  readonly memoryReferences: readonly GovernanceMemoryReference[];
  readonly relatedEventIds: readonly string[];
  readonly supersedesEntryId?: string;
}

export interface LedgerReadOptions {
  readonly reviewerRefId: string;
  readonly institutionScope: string;
}

export interface LedgerReader {
  readEntry(entryId: string, options: LedgerReadOptions): ContinuityLedgerEntry | null;
  listEntries(options: LedgerReadOptions): readonly ContinuityLedgerEntry[];
  listEntriesByKind(
    kind: LedgerEntryKind,
    options: LedgerReadOptions,
  ): readonly ContinuityLedgerEntry[];
}

export interface LedgerWriter {
  append(entry: ContinuityLedgerEntry): void;
  appendFromEvent(
    event: ContinuityEventEnvelope,
    entryKind: LedgerEntryKind,
    entryId: string,
  ): ContinuityLedgerEntry;
}
