/**
 * Sovereignty evidence ledger.
 *
 * In-process append-only ledger for sovereignty events.
 * MAX_ENTRIES = 10,000 with oldest-eviction.
 *
 * @module lib/federation-sovereignty/ledger
 */

import type {
  SovereigntyLedgerEntry,
  SovereigntyTier,
  DelegatedAuthority,
} from './types';

// ── Internal store ────────────────────────────────────────────────────────────

const MAX_ENTRIES = 10_000;
let _ledger: SovereigntyLedgerEntry[] = [];
let _entryCounter = 0;

function nextEntryId(): string {
  return `slgr_${Date.now()}_${++_entryCounter}`;
}

// ── Write ─────────────────────────────────────────────────────────────────────

/** Record a sovereignty event into the ledger. */
export function recordSovereigntyEvent(
  event: Omit<SovereigntyLedgerEntry, 'entryId' | 'timestamp' | 'governanceMode'>,
): SovereigntyLedgerEntry {
  const entry: SovereigntyLedgerEntry = {
    ...event,
    entryId: nextEntryId(),
    governanceMode: 'shadow',
    timestamp: new Date().toISOString(),
  };

  if (_ledger.length >= MAX_ENTRIES) {
    _ledger = _ledger.slice(_ledger.length - MAX_ENTRIES + 1);
  }

  _ledger.push(entry);
  return entry;
}

// ── Read ──────────────────────────────────────────────────────────────────────

/** Return a snapshot of the current ledger (copy, not reference). */
export function peekSovereigntyLedger(): readonly SovereigntyLedgerEntry[] {
  return [..._ledger];
}

/** Return entries for a specific federation unit. */
export function getLedgerForFederation(
  federationId: string,
): SovereigntyLedgerEntry[] {
  return _ledger.filter((e) => e.federationId === federationId);
}

/** Return entries by event type. */
export function getLedgerByEventType(
  eventType: SovereigntyLedgerEntry['eventType'],
): SovereigntyLedgerEntry[] {
  return _ledger.filter((e) => e.eventType === eventType);
}

/** Return entries by sovereignty tier. */
export function getLedgerByTier(tier: SovereigntyTier): SovereigntyLedgerEntry[] {
  return _ledger.filter((e) => e.tier === tier);
}

/** Return only escalation-related entries. */
export function getEscalationEntries(): SovereigntyLedgerEntry[] {
  return _ledger.filter(
    (e) => e.eventType === 'escalation-triggered' || e.outcome === 'escalated',
  );
}

/** Return only conflict-related entries. */
export function getConflictEntries(): SovereigntyLedgerEntry[] {
  return _ledger.filter(
    (e) =>
      e.eventType === 'conflict-detected' || e.eventType === 'conflict-resolved',
  );
}

// ── Summary ───────────────────────────────────────────────────────────────────

export interface SovereigntyLedgerSummary {
  totalEntries: number;
  delegationEvents: number;
  conflictEvents: number;
  escalationEvents: number;
  overrideAttempts: number;
  overrideRejections: number;
  continuityEvents: number;
  coordinationEvents: number;
  outcomeBreakdown: Record<SovereigntyLedgerEntry['outcome'], number>;
  tierBreakdown: Partial<Record<SovereigntyTier, number>>;
  authorityBreakdown: Partial<Record<DelegatedAuthority, number>>;
  generatedAt: string;
}

/** Generate an aggregated summary of the current ledger. */
export function getSovereigntyLedgerSummary(): SovereigntyLedgerSummary {
  const outcomeBreakdown: Record<SovereigntyLedgerEntry['outcome'], number> = {
    accepted: 0,
    rejected: 0,
    escalated: 0,
    pending: 0,
  };

  const tierBreakdown: Partial<Record<SovereigntyTier, number>> = {};
  const authorityBreakdown: Partial<Record<DelegatedAuthority, number>> = {};

  let delegationEvents = 0;
  let conflictEvents = 0;
  let escalationEvents = 0;
  let overrideAttempts = 0;
  let overrideRejections = 0;
  let continuityEvents = 0;
  let coordinationEvents = 0;

  for (const entry of _ledger) {
    outcomeBreakdown[entry.outcome]++;
    tierBreakdown[entry.tier] = (tierBreakdown[entry.tier] ?? 0) + 1;

    if (entry.authority) {
      authorityBreakdown[entry.authority] =
        (authorityBreakdown[entry.authority] ?? 0) + 1;
    }

    if (entry.eventType === 'delegation-granted' || entry.eventType === 'delegation-revoked')
      delegationEvents++;
    if (entry.eventType === 'conflict-detected' || entry.eventType === 'conflict-resolved')
      conflictEvents++;
    if (entry.eventType === 'escalation-triggered') escalationEvents++;
    if (entry.eventType === 'override-attempted') overrideAttempts++;
    if (entry.eventType === 'override-rejected') overrideRejections++;
    if (entry.eventType === 'continuity-shared') continuityEvents++;
    if (entry.eventType === 'coordination-event') coordinationEvents++;
  }

  return {
    totalEntries: _ledger.length,
    delegationEvents,
    conflictEvents,
    escalationEvents,
    overrideAttempts,
    overrideRejections,
    continuityEvents,
    coordinationEvents,
    outcomeBreakdown,
    tierBreakdown,
    authorityBreakdown,
    generatedAt: new Date().toISOString(),
  };
}

// ── Flush / reset ─────────────────────────────────────────────────────────────

/** Flush (drain) and return all current ledger entries. */
export function flushSovereigntyLedger(): SovereigntyLedgerEntry[] {
  const entries = [..._ledger];
  _ledger = [];
  return entries;
}

/** Clear the ledger entirely (for testing). */
export function clearSovereigntyLedger(): void {
  _ledger = [];
  _entryCounter = 0;
}
