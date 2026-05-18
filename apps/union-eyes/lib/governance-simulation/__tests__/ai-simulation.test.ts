import { describe, it, expect } from 'vitest';
import { simulateAIGovernance } from '../ai-simulation';
import { getAllScenarios, getScenario } from '../scenarios';

describe('governance-simulation/ai-simulation', () => {
  it('restricted operation requires human review', () => {
    const scenario = getScenario('ai.restricted-operation-escalation')!;
    const result = simulateAIGovernance(scenario);
    expect(result.humanReviewRequired).toBe(true);
    expect(result.riskTier).toBe('restricted');
  });

  it('restricted operation triggers escalation', () => {
    const scenario = getScenario('ai.restricted-operation-escalation')!;
    const result = simulateAIGovernance(scenario);
    expect(result.escalationTriggered).toBe(true);
  });

  it('restricted operation blocks the operation', () => {
    const scenario = getScenario('ai.restricted-operation-escalation')!;
    const result = simulateAIGovernance(scenario);
    expect(result.operationBlocked).toBe(true);
  });

  it('advisory-to-restricted transition detects reclassification', () => {
    const scenario = getScenario('ai.advisory-to-restricted-transition')!;
    const result = simulateAIGovernance(scenario);
    expect(result.riskReclassified).toBe(true);
    expect(result.escalationTriggered).toBe(true);
  });

  it('federation restriction blocks operation', () => {
    const scenario = getScenario('ai.federation-restriction')!;
    const result = simulateAIGovernance(scenario);
    expect(result.federationRestrictionApplied).toBe(true);
    expect(result.operationBlocked).toBe(true);
  });

  it('emits audit for sensitive operations', () => {
    const scenario = getScenario('ai.restricted-operation-escalation')!;
    const result = simulateAIGovernance(scenario);
    expect(result.auditEmitted).toBe(true);
  });

  it('does not throw on any built-in AI scenario', () => {
    const aiScenarios = getAllScenarios().filter((s) => s.scope === 'ai-operation');
    for (const s of aiScenarios) {
      expect(() => simulateAIGovernance(s)).not.toThrow();
    }
  });

  it('diagnostics note says no AI was called', () => {
    const scenario = getScenario('ai.restricted-operation-escalation')!;
    const result = simulateAIGovernance(scenario);
    expect(String(result.diagnostics['note'])).toContain('No AI service was called');
  });
});
