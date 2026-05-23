/**
 * Resilience Scenario Modeler
 *
 * Support operational continuity planning through scenario modeling.
 * Model: retirement wave, restructuring, governance transition, etc.
 */

import { simulateContinuityImpact } from '../simulation/continuity-simulator';
import type { SimulationScenario, ContinuitySimulationResult } from '../simulation/simulation-models';

export interface ResilienceScenarioModel {
  organizationId: string;
  generatedAt: string;
  scenarioName: string;
  scenarios: SimulationScenario[];
  results: ContinuitySimulationResult[];
  /** Comparison across scenarios */
  comparison: {
    bestCase: string;
    worstCase: string;
    averageImpact: number;
    commonVulnerabilities: string[];
  };
  /** Resilience recommendations across scenarios */
  crossScenarioMitigations: string[];
}

export const PRESET_SCENARIOS = {
  retirement_wave: (): SimulationScenario[] => [
    { simulationType: 'retirement', affectedNodeIds: [], affectedRoles: ['officer', 'steward'], timelineWeeks: 26 },
    { simulationType: 'retirement', affectedNodeIds: [], affectedRoles: ['officer', 'steward', 'chief_steward'], timelineWeeks: 26 },
  ],
  rapid_turnover: (): SimulationScenario[] => [
    { simulationType: 'sudden_departure', affectedNodeIds: [], affectedRoles: ['officer'], timelineWeeks: 4 },
    { simulationType: 'sudden_departure', affectedNodeIds: [], affectedRoles: ['steward'], timelineWeeks: 8 },
  ],
  governance_transition: (): SimulationScenario[] => [
    { simulationType: 'governance_knowledge_loss', affectedNodeIds: [], context: 'Policy framework change' },
  ],
  vendor_disruption: (): SimulationScenario[] => [
    { simulationType: 'vendor_loss', affectedNodeIds: [], context: 'Key vendor relationship termination' },
  ],
} as const;

export async function modelResilienceScenario(
  orgId: string,
  scenarioType: keyof typeof PRESET_SCENARIOS,
): Promise<ResilienceScenarioModel> {
  const scenarios = PRESET_SCENARIOS[scenarioType]();
  const results: ContinuitySimulationResult[] = [];

  for (const scenario of scenarios) {
    const result = await simulateContinuityImpact(orgId, scenario);
    results.push(result);
  }

  const impacts = results.map((r) => r.immediateImpactScore);
  const bestCase = results.reduce((min, r, i) => r.immediateImpactScore < impacts[min] ? i : min, 0);
  const worstCase = results.reduce((max, r, i) => r.immediateImpactScore > impacts[max] ? i : max, 0);

  const vulnerabilities = new Set<string>();
  results.forEach((r) => r.exacerbatedWeaknesses.forEach((w) => vulnerabilities.add(w.affectedArea)));

  return {
    organizationId: orgId,
    generatedAt: new Date().toISOString(),
    scenarioName: scenarioType,
    scenarios,
    results,
    comparison: {
      bestCase: scenarios[bestCase].simulationType,
      worstCase: scenarios[worstCase].simulationType,
      averageImpact: Math.round(impacts.reduce((a, b) => a + b, 0) / impacts.length),
      commonVulnerabilities: [...vulnerabilities],
    },
    crossScenarioMitigations: [
      'Cross-train across all critical roles',
      'Document all governance and compliance procedures',
      'Establish vendor relationships redundancy',
      'Build comprehensive organizational memory',
    ],
  };
}
