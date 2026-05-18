import { describe, it, expect, beforeEach } from 'vitest';
import { computeInstitutionalReadinessScore } from '../scoring';
import { clearSimulationLedger } from '../ledger';
import { runScenario } from '../simulation';
import { _resetScenarioCatalog } from '../scenarios';
import type { GovernanceSimulationResult } from '../types';

function makeResult(
  overrides: Partial<GovernanceSimulationResult> = {},
): GovernanceSimulationResult {
  return {
    scenarioId: 'test.scenario',
    simulatedAt: new Date().toISOString(),
    severity: 'informational',
    outcomesMatched: true,
    actualOutcomes: [],
    unmatchedExpected: [],
    escalationChain: [],
    continuityGapDetected: false,
    federationConflictDetected: false,
    governanceMode: 'shadow',
    diagnostics: {},
    ...overrides,
  };
}

describe('governance-simulation/scoring', () => {
  beforeEach(() => {
    clearSimulationLedger();
    _resetScenarioCatalog();
  });

  it('returns score with all dimensions on empty ledger', () => {
    const score = computeInstitutionalReadinessScore([]);
    expect(score.overall).toBeDefined();
    expect(score.continuity).toBeDefined();
    expect(score.federation).toBeDefined();
    expect(score.publication).toBeDefined();
    expect(score.aiAccountability).toBeDefined();
  });

  it('overall score is 0–100', () => {
    const score = computeInstitutionalReadinessScore([]);
    expect(score.overall).toBeGreaterThanOrEqual(0);
    expect(score.overall).toBeLessThanOrEqual(100);
  });

  it('continuity gap reduces continuity score', () => {
    const baseline = computeInstitutionalReadinessScore([]);
    const withGap = computeInstitutionalReadinessScore([
      makeResult({
        continuityGapDetected: true,
        diagnostics: { scope: 'continuity' },
      }),
    ]);
    expect(withGap.continuity.score).toBeLessThan(baseline.continuity.score);
  });

  it('federation conflict reduces federation score', () => {
    const baseline = computeInstitutionalReadinessScore([]);
    const withConflict = computeInstitutionalReadinessScore([
      makeResult({
        federationConflictDetected: true,
        diagnostics: { scope: 'federation' },
      }),
    ]);
    expect(withConflict.federation.score).toBeLessThan(baseline.federation.score);
  });

  it('scoredAt is an ISO timestamp', () => {
    const score = computeInstitutionalReadinessScore([]);
    expect(() => new Date(score.scoredAt)).not.toThrow();
  });

  it('simulationCount reflects provided ledger', () => {
    const results = [makeResult(), makeResult(), makeResult()];
    const score = computeInstitutionalReadinessScore(results);
    expect(score.simulationCount).toBe(3);
  });

  it('uses global ledger when no snapshot provided', () => {
    runScenario('federation.policy-tightening-cascade');
    runScenario('continuity.steward-turnover');
    const score = computeInstitutionalReadinessScore();
    expect(score.simulationCount).toBeGreaterThanOrEqual(2);
  });

  it('all sub-scores are 0–100', () => {
    const results = [
      makeResult({ continuityGapDetected: true, diagnostics: { scope: 'continuity' } }),
      makeResult({ federationConflictDetected: true, diagnostics: { scope: 'federation' } }),
    ];
    const score = computeInstitutionalReadinessScore(results);
    for (const dim of ['continuity', 'federation', 'publication', 'aiAccountability'] as const) {
      expect(score[dim].score).toBeGreaterThanOrEqual(0);
      expect(score[dim].score).toBeLessThanOrEqual(100);
    }
  });
});
