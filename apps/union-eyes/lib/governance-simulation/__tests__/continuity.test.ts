import { describe, it, expect } from 'vitest';
import { simulateContinuityStress } from '../continuity';
import { getAllScenarios, getScenario } from '../scenarios';

describe('governance-simulation/continuity', () => {
  it('detects continuity gap for steward-turnover', () => {
    const scenario = getScenario('continuity.steward-turnover')!;
    const result = simulateContinuityStress(scenario);
    expect(result.continuityGapDetected).toBe(true);
    expect(result.leadershipGap).toBe(true);
  });

  it('detects continuity gap for executive-turnover', () => {
    const scenario = getScenario('continuity.executive-turnover')!;
    const result = simulateContinuityStress(scenario);
    expect(result.continuityGapDetected).toBe(true);
    expect(result.leadershipGap).toBe(true);
  });

  it('detects audit chain break for audit-chain-loss', () => {
    const scenario = getScenario('continuity.audit-chain-loss')!;
    const result = simulateContinuityStress(scenario);
    expect(result.auditChainIntact).toBe(false);
    expect(result.continuityGapDetected).toBe(true);
  });

  it('detects governance orphan for governance-orphan scenario', () => {
    const scenario = getScenario('continuity.governance-orphan')!;
    const result = simulateContinuityStress(scenario);
    expect(result.governanceOrphanDetected).toBe(true);
  });

  it('escalation required when sensitivity is critical', () => {
    const scenario = getScenario('continuity.executive-turnover')!;
    const result = simulateContinuityStress(scenario);
    expect(result.escalationRequired).toBe(true);
  });

  it('returns affected roles', () => {
    const scenario = getScenario('continuity.steward-turnover')!;
    const result = simulateContinuityStress(scenario);
    expect(result.affectedRoles.length).toBeGreaterThan(0);
  });

  it('returns remediation steps', () => {
    const scenario = getScenario('continuity.audit-chain-loss')!;
    const result = simulateContinuityStress(scenario);
    expect(result.remediationSteps.length).toBeGreaterThan(0);
  });

  it('does not throw on any built-in continuity scenario', () => {
    const continuityScenarios = getAllScenarios().filter(
      (s) => s.scope === 'continuity',
    );
    for (const s of continuityScenarios) {
      expect(() => simulateContinuityStress(s)).not.toThrow();
    }
  });

  it('diagnostics includes governanceMode shadow', () => {
    const scenario = getScenario('continuity.steward-turnover')!;
    const result = simulateContinuityStress(scenario);
    expect(result.diagnostics['governanceMode']).toBe('shadow');
  });
});
