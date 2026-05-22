/**
 * ARTIFACT TYPE: Runtime Persistence
 * MODULE: OCI Continuity Ledger
 * DOCTRINE_VERSION: 1.0.0
 *
 * In-memory ledger composition runtime.
 *
 * NON-BINDING SKETCH:
 *   At-rest persistence is governed by `OCI_DATA_HANDLING.md`. This module
 *   provides the deterministic composition surface only. It is safe to use
 *   in tests and in reviewer-led runtime composition.
 *
 * Posture:
 *   - Append-only. Entries are never edited in place.
 *   - Institution-scoped. Cross-institution reads return empty.
 *   - Refusal-friendly. Missing reviewer reference returns null/empty.
 */

import type {
  ContinuityLedgerEntry,
  LedgerEntryKind,
  LedgerReadOptions,
  LedgerReader,
  LedgerWriter,
} from './continuityLedgerContracts';
import { CONTINUITY_LEDGER_VERSION } from './continuityLedgerContracts';
import type { ContinuityEventEnvelope } from '../contracts/runtimeContracts';

export interface ContinuityLedger extends LedgerReader, LedgerWriter {}

export function createContinuityLedger(): ContinuityLedger {
  const entries: ContinuityLedgerEntry[] = [];

  function append(entry: ContinuityLedgerEntry): void {
    entries.push(entry);
  }

  function appendFromEvent(
    event: ContinuityEventEnvelope,
    entryKind: LedgerEntryKind,
    entryId: string,
  ): ContinuityLedgerEntry {
    const entry: ContinuityLedgerEntry = {
      ledgerVersion: CONTINUITY_LEDGER_VERSION,
      entryId,
      entryKind,
      institutionScope: event.institutionScope,
      statedAt: event.observedAt,
      statement: event.statement,
      lineage: event.lineage,
      memoryReferences: event.memoryReferences,
      relatedEventIds: [event.eventId],
    };
    append(entry);
    return entry;
  }

  function isAuthorisedRead(options: LedgerReadOptions): boolean {
    return !!options.reviewerRefId && !!options.institutionScope;
  }

  function readEntry(
    entryId: string,
    options: LedgerReadOptions,
  ): ContinuityLedgerEntry | null {
    if (!isAuthorisedRead(options)) return null;
    const found = entries.find(
      (e) => e.entryId === entryId && e.institutionScope === options.institutionScope,
    );
    return found ?? null;
  }

  function listEntries(options: LedgerReadOptions): readonly ContinuityLedgerEntry[] {
    if (!isAuthorisedRead(options)) return [];
    return [...entries.filter((e) => e.institutionScope === options.institutionScope)].sort(
      (a, b) => a.statedAt.localeCompare(b.statedAt) || a.entryId.localeCompare(b.entryId),
    );
  }

  function listEntriesByKind(
    kind: LedgerEntryKind,
    options: LedgerReadOptions,
  ): readonly ContinuityLedgerEntry[] {
    return listEntries(options).filter((e) => e.entryKind === kind);
  }

  return { append, appendFromEvent, readEntry, listEntries, listEntriesByKind };
}
