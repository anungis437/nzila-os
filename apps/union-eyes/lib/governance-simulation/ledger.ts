/**
 * Governance simulation result ledger.
 *
 * In-process ledger for simulation results. Provides the same
 * record/peek/flush/clear pattern as the observability ledger (Wave 8).
 *
 * This ledger:
 *   - Is in-process only (no external I/O)
 *   - Is shadow-mode only
 *   - Never blocks or throws
 *   - Can be flushed and serialized for procurement reports
 *
 * @module lib/governance-simulation/ledger
 */

import type { GovernanceSimulationResult, SimulationSeverity } from './types';

// ── In-process ledger ─────────────────────────────────────────────────────────

const _ledger: GovernanceSimulationResult[] = [];

const MAX_LEDGER_SIZE = 10_000;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Record a simulation result to the ledger.
 * Never throws.
 */
export function recordSimulationResult(result: GovernanceSimulationResult): void {
  try {
    if (_ledger.length >= MAX_LEDGER_SIZE) {
      // Drop oldest entry to prevent unbounded growth
      _ledger.shift();
    }
    _ledger.push(result);
  } catch {
    // Fail silently — ledger must never affect simulation callers
  }
}

/**
 * Return a snapshot of all ledger entries (non-destructive).
 */
export function peekSimulationLedger(): readonly GovernanceSimulationResult[] {
  return [..._ledger];
}

/**
 * Flush and return all ledger entries (destructive — clears ledger).
 */
export function flushSimulationLedger(): GovernanceSimulationResult[] {
  return _ledger.splice(0, _ledger.length);
}

/**
 * Clear the ledger without returning entries.
 * Primarily used in tests to ensure isolation.
 */
export function clearSimulationLedger(): void {
  _ledger.splice(0, _ledger.length);
}

// ── Aggregation / summary ─────────────────────────────────────────────────────

export interface SimulationLedgerSummary {
  totalSimulations: number;
  outcomeMatchRate: number;  // 0–1
  severityBreakdown: Record<SimulationSeverity, number>;
  escalationsTriggered: number;
  continuityGapsDetected: number;
  federationConflictsDetected: number;
  scenarioIds: string[];
  generatedAt: string;
}

/**
 * Compute a summary of the current ledger state.
 * Non-destructive.
 */
export function getSimulationSummary(): SimulationLedgerSummary {
  const entries = [..._ledger];

  const severityBreakdown: Record<SimulationSeverity, number> = {
    'informational': 0,
    'elevated': 0,
    'critical': 0,
    'institutional-risk': 0,
  };

  let matched = 0;
  let escalations = 0;
  let continuityGaps = 0;
  let federationConflicts = 0;

  for (const e of entries) {
    severityBreakdown[e.severity]++;
    if (e.outcomesMatched) matched++;
    if (e.escalationChain.length > 0) escalations++;
    if (e.continuityGapDetected) continuityGaps++;
    if (e.federationConflictDetected) federationConflicts++;
  }

  return {
    totalSimulations: entries.length,
    outcomeMatchRate: entries.length > 0 ? matched / entries.length : 0,
    severityBreakdown,
    escalationsTriggered: escalations,
    continuityGapsDetected: continuityGaps,
    federationConflictsDetected: federationConflicts,
    scenarioIds: [...new Set(entries.map((e) => e.scenarioId))],
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Return ledger entries filtered by severity.
 */
export function getLedgerBySeverity(
  severity: SimulationSeverity,
): GovernanceSimulationResult[] {
  return _ledger.filter((e) => e.severity === severity);
}

/**
 * Return ledger entries for a specific scenario ID.
 */
export function getLedgerByScenario(
  scenarioId: string,
): GovernanceSimulationResult[] {
  return _ledger.filter((e) => e.scenarioId === scenarioId);
}
