import { describe, it, expect } from 'vitest';
import { simulateFederationConflict } from '../federation';
import { getAllScenarios, getScenario } from '../scenarios';

describe('governance-simulation/federation', () => {
  it('detects conflict for policy-tightening-cascade', () => {
    const scenario = getScenario('federation.policy-tightening-cascade')!;
    const result = simulateFederationConflict(scenario);
    expect(result.conflictDetected).toBe(true);
  });

  it('rejects override for local-weakening-attempt', () => {
    const scenario = getScenario('federation.local-weakening-attempt')!;
    const result = simulateFederationConflict(scenario);
    expect(result.overrideRejected).toBe(true);
    expect(result.overrideOutcome).toBe('rejected');
  });

  it('detects deadlock for governance-deadlock scenario', () => {
    const scenario = getScenario('federation.governance-deadlock')!;
    const result = simulateFederationConflict(scenario);
    expect(result.deadlockDetected).toBe(true);
    expect(result.deadlockResolution).not.toBe('none');
  });

  it('blocks publication for local federation scenario', () => {
    const scenario = getScenario('publication.federation-dispute')!;
    const result = simulateFederationConflict(scenario);
    expect(result.publicationBlocked).toBe(true);
    expect(result.federationReviewRequired).toBe(true);
  });

  it('inheritance path for local tier includes national', () => {
    const scenario = getScenario('federation.policy-tightening-cascade')!;
    const result = simulateFederationConflict(scenario);
    expect(result.inheritancePath).toContain('national');
    expect(result.inheritancePath).toContain('local');
  });

  it('escalation path is populated when escalation required', () => {
    const scenario = getScenario('federation.governance-deadlock')!;
    const result = simulateFederationConflict(scenario);
    expect(result.escalationRequired).toBe(true);
    expect(result.escalationPath.length).toBeGreaterThan(0);
  });

  it('does not throw on any built-in federation scenario', () => {
    const fedScenarios = getAllScenarios().filter(
      (s) => s.scope === 'federation',
    );
    for (const s of fedScenarios) {
      expect(() => simulateFederationConflict(s)).not.toThrow();
    }
  });

  it('always sets governanceMode shadow in diagnostics', () => {
    const scenario = getScenario('federation.policy-tightening-cascade')!;
    const result = simulateFederationConflict(scenario);
    expect(result.diagnostics['governanceMode']).toBe('shadow');
  });
});
