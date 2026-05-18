/**
 * Governance observability evidence ledger.
 *
 * The in-process ledger accumulates `GovernanceObservabilityEvent` records
 * for the lifetime of the process. Events are written fire-and-forget by the
 * telemetry adapter functions in `telemetry.ts`.
 *
 * The ledger is flushed by:
 *   - `scripts/generate-governance-ledger.ts` (periodic / deploy-time)
 *   - Tests (via `clearObservabilityLedger()`)
 *
 * The ledger is NOT a durable store. Durability is the responsibility of an
 * external pipeline (log aggregator, governance event bus). Wave 8 only
 * classifies, correlates, and accumulates in memory.
 *
 * @module lib/governance-observability/ledger
 */

import type { GovernanceObservabilityEvent } from './types';

// ── Internal store ────────────────────────────────────────────────────────────

const _events: GovernanceObservabilityEvent[] = [];

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Append an observability event to the in-process ledger.
 * Never throws — any error is silently suppressed to preserve operational continuity.
 */
export function recordObservabilityEvent(
  event: GovernanceObservabilityEvent,
): void {
  try {
    _events.push(event);
  } catch {
    // fail-safe: ledger write failures must never affect the request path
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Return a read-only snapshot of the current ledger without clearing it.
 */
export function peekObservabilityLedger(): readonly GovernanceObservabilityEvent[] {
  return _events;
}

/**
 * Flush and clear the in-process ledger.
 * Returns all accumulated events and clears the store.
 * Used by report generators and tests.
 */
export function flushObservabilityLedger(): GovernanceObservabilityEvent[] {
  const snapshot = [..._events];
  _events.length = 0;
  return snapshot;
}

/**
 * Clear the ledger without returning events.
 * For test teardown use only.
 */
export function clearObservabilityLedger(): void {
  _events.length = 0;
}

// ── Query helpers ─────────────────────────────────────────────────────────────

/**
 * Return all events in the ledger matching a given category.
 */
export function getEventsByCategory(
  category: GovernanceObservabilityEvent['category'],
): GovernanceObservabilityEvent[] {
  return _events.filter((e) => e.category === category);
}

/**
 * Return all events sharing a governance correlation ID.
 */
export function getEventsByCorrelationId(
  correlationId: string,
): GovernanceObservabilityEvent[] {
  return _events.filter(
    (e) => e.correlation.governanceCorrelationId === correlationId,
  );
}

/**
 * Return a summary of the current ledger state for reporting.
 */
export function getLedgerSummary(): {
  total: number;
  byCategory: Record<string, number>;
  bySensitivity: Record<string, number>;
  byRetentionClass: Record<string, number>;
} {
  const byCategory: Record<string, number> = {};
  const bySensitivity: Record<string, number> = {};
  const byRetentionClass: Record<string, number> = {};

  for (const e of _events) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
    bySensitivity[e.sensitivity] = (bySensitivity[e.sensitivity] ?? 0) + 1;
    byRetentionClass[e.retentionClass] = (byRetentionClass[e.retentionClass] ?? 0) + 1;
  }

  return { total: _events.length, byCategory, bySensitivity, byRetentionClass };
}
