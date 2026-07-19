import { describe, expect, it, vi } from 'vitest';

const { simulateContinuityImpact } = vi.hoisted(() => ({ simulateContinuityImpact: vi.fn() }));
vi.mock('../../simulation/continuity-simulator', () => ({ simulateContinuityImpact }));

import { modelResilienceScenario, PRESET_SCENARIOS } from '../scenario-modeler';

function result(impact: number, areas: string[]) {
  return {
    immediateImpactScore: impact,
    exacerbatedWeaknesses: areas.map((affectedArea) => ({ affectedArea })),
  };
}

describe('lib/knowledge-transfer/scenarios/scenario-modeler', () => {
  it('exposes preset scenario builders', () => {
    expect(PRESET_SCENARIOS.retirement_wave().length).toBe(2);
    expect(PRESET_SCENARIOS.rapid_turnover().length).toBe(2);
    expect(PRESET_SCENARIOS.governance_transition().length).toBe(1);
    expect(PRESET_SCENARIOS.vendor_disruption().length).toBe(1);
  });

  it('models a multi-scenario retirement wave with comparison', async () => {
    simulateContinuityImpact
      .mockResolvedValueOnce(result(30, ['governance', 'documentation']))
      .mockResolvedValueOnce(result(70, ['governance', 'vendor']));
    const model = await modelResilienceScenario('org-1', 'retirement_wave');
    expect(model.results.length).toBe(2);
    expect(model.comparison.averageImpact).toBe(50);
    expect(model.comparison.bestCase).toBe('retirement');
    expect(model.comparison.worstCase).toBe('retirement');
    expect(model.comparison.commonVulnerabilities).toContain('governance');
    expect(model.crossScenarioMitigations.length).toBeGreaterThan(0);
  });

  it('models a single-scenario governance transition', async () => {
    simulateContinuityImpact.mockResolvedValue(result(45, ['governance']));
    const model = await modelResilienceScenario('org-2', 'governance_transition');
    expect(model.results.length).toBe(1);
    expect(model.scenarioName).toBe('governance_transition');
    expect(model.comparison.averageImpact).toBe(45);
  });
});
