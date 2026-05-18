import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordSimulationResult,
  peekSimulationLedger,
  flushSimulationLedger,
  clearSimulationLedger,
  getSimulationSummary,
  getLedgerBySeverity,
  getLedgerByScenario,
} from '../ledger';
import type { GovernanceSimulationResult } from '../types';

function makeResult(
  id: string,
  severity: GovernanceSimulationResult['severity'] = 'informational',
  overrides: Partial<GovernanceSimulationResult> = {},
): GovernanceSimulationResult {
  return {
    scenarioId: id,
    simulatedAt: new Date().toISOString(),
    severity,
    outcomesMatched: true,
    actualOutcomes: ['audit.emitted'],
    unmatchedExpected: [],
    escalationChain: [],
    continuityGapDetected: false,
    federationConflictDetected: false,
    governanceMode: 'shadow',
    diagnostics: {},
    ...overrides,
  };
}

describe('governance-simulation/ledger', () => {
  beforeEach(() => {
    clearSimulationLedger();
  });

  it('starts empty', () => {
    expect(peekSimulationLedger().length).toBe(0);
  });

  it('records results', () => {
    recordSimulationResult(makeResult('test.scenario'));
    expect(peekSimulationLedger().length).toBe(1);
  });

  it('peek is non-destructive', () => {
    recordSimulationResult(makeResult('test.scenario'));
    peekSimulationLedger();
    expect(peekSimulationLedger().length).toBe(1);
  });

  it('flush clears ledger and returns entries', () => {
    recordSimulationResult(makeResult('test.scenario'));
    const flushed = flushSimulationLedger();
    expect(flushed.length).toBe(1);
    expect(peekSimulationLedger().length).toBe(0);
  });

  it('clear wipes ledger', () => {
    recordSimulationResult(makeResult('test.scenario'));
    clearSimulationLedger();
    expect(peekSimulationLedger().length).toBe(0);
  });

  it('getLedgerBySeverity filters correctly', () => {
    recordSimulationResult(makeResult('a', 'critical'));
    recordSimulationResult(makeResult('b', 'informational'));
    expect(getLedgerBySeverity('critical').length).toBe(1);
    expect(getLedgerBySeverity('informational').length).toBe(1);
  });

  it('getLedgerByScenario filters by scenario id', () => {
    recordSimulationResult(makeResult('target.scenario'));
    recordSimulationResult(makeResult('other.scenario'));
    expect(getLedgerByScenario('target.scenario').length).toBe(1);
  });

  describe('getSimulationSummary', () => {
    it('returns 0 simulations when empty', () => {
      const summary = getSimulationSummary();
      expect(summary.totalSimulations).toBe(0);
      expect(summary.outcomeMatchRate).toBe(0);
    });

    it('counts total simulations', () => {
      recordSimulationResult(makeResult('a'));
      recordSimulationResult(makeResult('b'));
      expect(getSimulationSummary().totalSimulations).toBe(2);
    });

    it('outcome match rate is 1 when all match', () => {
      recordSimulationResult(makeResult('a', 'informational', { outcomesMatched: true }));
      expect(getSimulationSummary().outcomeMatchRate).toBe(1);
    });

    it('outcome match rate is 0 when none match', () => {
      recordSimulationResult(makeResult('a', 'informational', { outcomesMatched: false }));
      expect(getSimulationSummary().outcomeMatchRate).toBe(0);
    });

    it('counts continuity gaps', () => {
      recordSimulationResult(makeResult('a', 'institutional-risk', { continuityGapDetected: true }));
      expect(getSimulationSummary().continuityGapsDetected).toBe(1);
    });

    it('counts federation conflicts', () => {
      recordSimulationResult(makeResult('a', 'critical', { federationConflictDetected: true }));
      expect(getSimulationSummary().federationConflictsDetected).toBe(1);
    });

    it('includes unique scenario IDs', () => {
      recordSimulationResult(makeResult('scenario.a'));
      recordSimulationResult(makeResult('scenario.a'));
      recordSimulationResult(makeResult('scenario.b'));
      const summary = getSimulationSummary();
      expect(summary.scenarioIds).toContain('scenario.a');
      expect(summary.scenarioIds).toContain('scenario.b');
      expect(summary.scenarioIds.length).toBe(2);
    });
  });
});
