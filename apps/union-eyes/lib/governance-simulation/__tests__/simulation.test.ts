import { describe, it, expect, beforeEach } from 'vitest';
import { runScenario, replayScenario } from '../simulation';
import { clearSimulationLedger, peekSimulationLedger } from '../ledger';
import { _resetScenarioCatalog } from '../scenarios';

describe('governance-simulation/simulation', () => {
  beforeEach(() => {
    clearSimulationLedger();
    _resetScenarioCatalog();
  });

  it('returns error result for unknown scenario', () => {
    const result = runScenario('nonexistent.scenario');
    expect(result.outcomesMatched).toBe(false);
    expect(result.diagnostics['error']).toContain('not found');
    expect(result.governanceMode).toBe('shadow');
  });

  it('always returns governanceMode === shadow', () => {
    const result = runScenario('federation.policy-tightening-cascade');
    expect(result.governanceMode).toBe('shadow');
  });

  it('federation conflict produces expected outcomes', () => {
    const result = runScenario('federation.policy-tightening-cascade');
    expect(result.actualOutcomes).toContain('inheritance.cascade.triggered');
    expect(result.actualOutcomes).toContain('local.publication.blocked');
    expect(result.actualOutcomes).toContain('escalation.triggered');
  });

  it('federation conflict detects federation conflict', () => {
    const result = runScenario('federation.policy-tightening-cascade');
    expect(result.federationConflictDetected).toBe(true);
  });

  it('continuity steward turnover detects continuity gap', () => {
    const result = runScenario('continuity.steward-turnover');
    expect(result.continuityGapDetected).toBe(true);
    expect(result.actualOutcomes).toContain('continuity.gap.detected');
  });

  it('unauthorized publication produces publication.blocked', () => {
    const result = runScenario('publication.unauthorized-attempt');
    expect(result.actualOutcomes).toContain('publication.blocked');
    expect(result.actualOutcomes).toContain('approval.required');
  });

  it('AI restricted operation triggers human-review', () => {
    const result = runScenario('ai.restricted-operation-escalation');
    expect(result.actualOutcomes).toContain('human-review.triggered');
    expect(result.actualOutcomes).toContain('ai-operation.escalated');
  });

  it('policy breach incident emits audit', () => {
    const result = runScenario('incident.policy-breach');
    expect(result.actualOutcomes).toContain('audit.emitted');
    expect(result.actualOutcomes).toContain('policy.breach.detected');
  });

  it('records results to ledger', () => {
    runScenario('federation.policy-tightening-cascade');
    runScenario('continuity.steward-turnover');
    const ledger = peekSimulationLedger();
    expect(ledger.length).toBeGreaterThanOrEqual(2);
  });

  it('high-severity scenarios produce elevated/critical/institutional-risk severity', () => {
    const result = runScenario('continuity.audit-chain-loss');
    expect(['elevated', 'critical', 'institutional-risk']).toContain(result.severity);
  });

  describe('replayScenario', () => {
    it('returns divergenceDetected:false when replaying with same conditions', () => {
      const replay = replayScenario({
        scenarioId: 'federation.policy-tightening-cascade',
        replayLabel: 'same-conditions',
      });
      // Severity and chain should match without overrides
      expect(replay.divergenceDetected).toBe(false);
    });

    it('returns error result for unknown scenario', () => {
      const replay = replayScenario({
        scenarioId: 'nonexistent.scenario',
        replayLabel: 'test',
      });
      expect(replay.original.diagnostics['error']).toBeTruthy();
    });

    it('replay has same governanceMode=shadow for both sides', () => {
      const replay = replayScenario({
        scenarioId: 'continuity.steward-turnover',
        replayLabel: 'shadow-check',
      });
      expect(replay.original.governanceMode).toBe('shadow');
      expect(replay.replayed.governanceMode).toBe('shadow');
    });
  });
});
