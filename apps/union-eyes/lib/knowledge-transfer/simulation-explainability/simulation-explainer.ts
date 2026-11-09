/**
 * Simulation Explainability — Render Reasoning Chains
 *
 * Expose simulation reasoning, assumptions, and evidence lineage.
 */

import type { ContinuitySimulationResult } from '../simulation/simulation-models';
import { evidenceCoverageScoreFromSampleSize } from '../governance/evidence-basis';

export interface SimulationExplanation {
  simulationId: string;
  scenario: string;
  /** Step-by-step reasoning */
  reasoningChain: Array<{
    step: number;
    description: string;
    assumption: string;
    evidence: string[];
  }>;
  /** Key assumptions that drove results */
  keyAssumptions: string[];
  /** Sources of impact calculations */
  sourceEvidence: Array<{ source: string; contribution: string }>;
  /**
   * How many operational domains this simulation actually modeled (0-100) - a volume measure, never a claim that
   * the immediate, 12-week or recovery figures are independently validated. Previously three fixed literals
   * (75/50/60) returned unconditionally for every simulation regardless of its actual domainImpacts; replaced with
   * the same evidence-coverage convention used elsewhere in this family (DEF-0B7-COGA-RISK-RATINGS-ARE-FIXED-RULES-
   * OVER-TAG-COUNTS) rather than inventing a fixed-per-field "confidence" this function has no basis to assert.
   */
  evidenceCoverageScore: number;
  /** Limitations and caveats */
  limitations: string[];
}

export function explainSimulation(simulation: ContinuitySimulationResult): SimulationExplanation {
  const chain: Array<{
    step: number;
    description: string;
    assumption: string;
    evidence: string[];
  }> = [];

  chain.push({
    step: 1,
    description: 'Identified affected operational domains',
    assumption: 'All identified domains would be directly impacted by scenario',
    evidence: simulation.domainImpacts.map((d) => `${d.domain}: ${d.degradationPercentage}% degradation`),
  });

  chain.push({
    step: 2,
    description: 'Computed immediate impact score',
    assumption: 'Domain impacts aggregate linearly',
    evidence: [`Immediate impact: ${simulation.immediateImpactScore}%`],
  });

  chain.push({
    step: 3,
    description: 'Identified exacerbated weaknesses',
    assumption: 'Single-source and vendor-concentrated areas fail first',
    evidence: simulation.exacerbatedWeaknesses.map((w) => `${w.affectedArea}: ${w.weaknessType}`),
  });

  chain.push({
    step: 4,
    description: 'Projected 12-week continuity degradation',
    assumption: `Degradation accelerates at ${simulation.degradationTimeline[6]?.accelerationFactor || 1.0}x baseline after 6 weeks`,
    evidence: [`Projected 12-week health: ${simulation.twelveWeekProjection}%`],
  });

  chain.push({
    step: 5,
    description: 'Estimated recovery capability',
    assumption: 'Organization can recover autonomously if conditions support',
    evidence: [`Autonomous recovery probability: ${simulation.autonomousRecoveryProbability}%`],
  });

  return {
    simulationId: `sim_${Date.now()}`,
    scenario: simulation.scenario.simulationType,
    reasoningChain: chain,
    keyAssumptions: [
      'Simulation assumes no external intervention during degradation period',
      'Recovery timeline assumes immediate mitigation actions',
      'Documentation quality assessments based on interview patterns',
      'Cascading failures modeled as exponential decay',
    ],
    sourceEvidence: [
      { source: 'Dependency propagation map', contribution: 'Identifies cascading failure paths' },
      { source: 'Interview content analysis', contribution: 'Determines documentation quality' },
      { source: 'Organizational structure', contribution: 'Maps role dependencies' },
    ],
    evidenceCoverageScore: evidenceCoverageScoreFromSampleSize(simulation.domainImpacts.length),
    limitations: [
      'Simulation assumes independent failures (ignores simultaneous disruptions)',
      'Recovery estimates based on organizational maturity heuristics',
      'External vendor behavior not fully modeled',
      'Psychological factors and crisis management not accounted for',
    ],
  };
}
