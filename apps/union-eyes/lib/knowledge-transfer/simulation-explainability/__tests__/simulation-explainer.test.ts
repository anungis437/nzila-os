import { describe, expect, it } from 'vitest';
import { explainSimulation } from '../simulation-explainer';
import type { ContinuitySimulationResult } from '../../simulation/simulation-models';

function sim(): ContinuitySimulationResult {
  return {
    organizationId: 'org-1',
    generatedAt: '2025-01-01',
    scenario: { simulationType: 'retirement', affectedNodeIds: ['n1'] },
    baselineContinuityScore: 70,
    immediateImpactScore: 55,
    twelveWeekProjection: 30,
    overallImpactSeverity: 'high',
    domainImpacts: [
      { domain: 'Payroll', impactSeverity: 'high', degradationPercentage: 60, timeToExposure: 4, hasWorkarounds: false, workaroundComplexity: 'complex' },
    ],
    degradationTimeline: Array.from({ length: 12 }, (_, i) => ({
      week: i, healthScore: 70 - i * 3, domainsAtRisk: 1, accelerationFactor: 1.2, criticalEvents: [],
    })),
    exacerbatedWeaknesses: [
      { weaknessType: 'single_source', affectedArea: 'Payroll', severity: 'critical', isExacerbated: true, mitigation: 'm' },
    ],
    immediateActions: [],
    mitigation30Day: [],
    remediation90Day: [],
    recoveryEffortEstimate: 'high',
    autonomousRecoveryProbability: 40,
    governanceBodiesAffected: 0,
    complianceRiskCreated: false,
    executiveSummary: 's',
  };
}

describe('lib/knowledge-transfer/simulation-explainability/simulation-explainer', () => {
  it('builds a 5-step reasoning chain with evidence and metadata', () => {
    const exp = explainSimulation(sim());
    expect(exp.scenario).toBe('retirement');
    expect(exp.reasoningChain.length).toBe(5);
    expect(exp.reasoningChain[0].evidence[0]).toContain('Payroll');
    expect(exp.reasoningChain[2].evidence[0]).toContain('single_source');
    expect(exp.reasoningChain[3].assumption).toContain('1.2x');
    expect(exp.keyAssumptions.length).toBeGreaterThan(0);
    expect(exp.sourceEvidence.length).toBe(3);
    // DEF-0B7-COGA-RISK-RATINGS-ARE-FIXED-RULES-OVER-TAG-COUNTS: evidence coverage must come from how many domains
    // this simulation actually modeled, not a fixed literal returned for every simulation regardless of input.
    expect(exp.evidenceCoverageScore).toBe(40); // 1 domainImpact, below MIN_COHORT_SIZE
    expect(exp.limitations.length).toBeGreaterThan(0);
    expect(exp.simulationId).toMatch(/^sim_/);
  });

  it('defaults acceleration when timeline lacks week 6', () => {
    const s = sim();
    s.degradationTimeline = [];
    const exp = explainSimulation(s);
    expect(exp.reasoningChain[3].assumption).toContain('1x');
  });

  it('evidence coverage score varies with how many domains were actually modeled, not a fixed number', () => {
    const none = sim();
    none.domainImpacts = [];
    expect(explainSimulation(none).evidenceCoverageScore).toBe(0);

    const many = sim();
    many.domainImpacts = Array.from({ length: 10 }, (_, i) => ({
      domain: `Domain ${i}`, impactSeverity: 'low' as const, degradationPercentage: 10, timeToExposure: 8, hasWorkarounds: true, workaroundComplexity: 'simple' as const,
    }));
    expect(explainSimulation(many).evidenceCoverageScore).toBe(80);
  });
});
