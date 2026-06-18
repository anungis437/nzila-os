/**
 * Decision Intelligence Engine — Unit Tests
 *
 * Drives generateDecisionBrief with mocked propagation map, resilience index,
 * and forecast to exercise all four recommendation builders, sorting, current
 * state/strength/gap derivation, governance exposure tiers, and summaries.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ buildMap: vi.fn(), resilience: vi.fn(), forecast: vi.fn() }));

vi.mock('@/lib/knowledge-transfer/propagation/dependency-propagator', () => ({
  buildDependencyPropagationMap: mocks.buildMap,
}));
vi.mock('@/lib/knowledge-transfer/resilience-index/resilience-calculator', () => ({
  calculateResilienceIndex: mocks.resilience,
}));
vi.mock('@/lib/knowledge-transfer/forecasting/continuity-forecaster', () => ({
  forecastContinuityTrends: mocks.forecast,
}));

import { generateDecisionBrief } from '../decision-engine';

function node(id: string, category: string, isSingleSource: boolean, sensitivity = 'low', frequency = 5) {
  return {
    id, label: id, nodeType: category, category, frequency: isSingleSource ? 1 : frequency,
    associatedRoles: ['R'], isSingleSource, continuitySensitivity: sensitivity, sensitivityReason: '',
  };
}

function propMap(nodes: unknown[], downstreamImpacts: unknown[] = [], bottlenecks: unknown[] = []) {
  return {
    organizationId: 'org', generatedAt: new Date().toISOString(),
    nodes, edges: [], downstreamImpacts, upstreamDependencies: [], couplingAnalysis: [],
    bottlenecks, resilience: { recommendations: [], priorityOrder: [], estimatedEffort: {} },
  };
}

function resilienceIndex(overallScore: number, status: string, dimensions: unknown[] = []) {
  return {
    organizationId: 'org', generatedAt: new Date().toISOString(), overallScore, status,
    dimensions, trend: 'stable', maturityLevel: 'developing', recommendations: [],
  };
}

describe('generateDecisionBrief', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.forecast.mockResolvedValue({ trendDirection: 'stable' });
    mocks.resilience.mockResolvedValue(resilienceIndex(80, 'strong', [{ name: 'Knowledge Redundancy', score: 85 }]));
    mocks.buildMap.mockResolvedValue(propMap([node('x', 'general', false)]));
  });

  it('produces no recommendations for a healthy org', async () => {
    const brief = await generateDecisionBrief('org');
    expect(brief.recommendations).toHaveLength(0);
    expect(brief.topPriority).toBeNull();
    expect(brief.currentStateAssessment).toContain('strong');
    expect(brief.executiveSummary).toContain('No critical continuity gaps');
    expect(brief.continuityStrengths.some((s) => s.includes('Knowledge Redundancy'))).toBe(true);
  });

  it('generates and sorts all four recommendation types for a fragile org', async () => {
    mocks.forecast.mockResolvedValue({ trendDirection: 'degrading' });
    mocks.resilience.mockResolvedValue(
      resilienceIndex(25, 'critical', [
        { name: 'Knowledge Redundancy', score: 20 },
        { name: 'Documentation Maturity', score: 75 },
      ]),
    );
    const nodes = [
      node('gov1', 'governance', true, 'critical'),
      node('gov2', 'governance', true, 'critical'),
      node('gov3', 'compliance', true, 'critical'),
      node('vend1', 'vendor', true, 'high'),
      node('vend2', 'vendor', true, 'high'),
      node('vend3', 'vendor', true, 'high'),
      node('sys1', 'system', true, 'high'),
      node('sys2', 'system', true, 'high'),
      node('exp1', 'expertise', true, 'critical'),
    ];
    const downstream = [
      { nodeId: 'gov1', directDependents: ['gov2'], allAffectedNodes: ['gov2'], propagationPaths: [], totalExposureScore: 80, governanceExposure: [], vendorDependencyExposure: [], mitigation: { priority: 'critical', actions: [] } },
      { nodeId: 'sys1', directDependents: ['sys2'], allAffectedNodes: ['sys2'], propagationPaths: [], totalExposureScore: 60, governanceExposure: [], vendorDependencyExposure: [], mitigation: { priority: 'high', actions: [] } },
    ];
    const bottlenecks = [{ nodeId: 'gov1', reason: 'single_source', riskLevel: 'critical', affectedRoles: ['R'] }];
    mocks.buildMap.mockResolvedValue(propMap(nodes, downstream, bottlenecks));

    const brief = await generateDecisionBrief('org');

    const categories = brief.recommendations.map((r) => r.category);
    expect(categories).toContain('redundancy_investment');
    expect(categories).toContain('governance_stabilization');
    expect(categories).toContain('documentation_investment');
    expect(categories).toContain('vendor_resilience');

    // sorted: immediate urgency first
    expect(brief.recommendations[0].urgency).toBe('immediate');
    expect(brief.topPriority).not.toBeNull();
    expect(brief.topPriority!.id).toBe(brief.recommendations[0].id);

    // critical state assessment
    expect(brief.currentStateAssessment).toContain('critical continuity fragility');
    // critical gaps populated incl forecast degrading + bottlenecks + gov single-source
    expect(brief.criticalGaps.some((g) => g.includes('critical-sensitivity'))).toBe(true);
    expect(brief.criticalGaps.some((g) => g.includes('governance/compliance'))).toBe(true);
    expect(brief.criticalGaps.some((g) => g.includes('bottlenecks'))).toBe(true);
    expect(brief.criticalGaps.some((g) => g.includes('trending downward'))).toBe(true);
    // governance exposure highly concentrated (100% single source)
    expect(brief.governanceExposureSummary).toContain('highly concentrated');
    expect(brief.executiveSummary).toContain('Highest priority');
    expect(brief.executiveSummary).toContain('degrading');
  });

  it('covers at_risk and adequate state + moderate/low governance tiers', async () => {
    // at_risk path
    mocks.resilience.mockResolvedValue(resilienceIndex(50, 'at_risk', []));
    mocks.buildMap.mockResolvedValue(
      propMap([
        node('gov1', 'governance', true, 'high'),
        node('gov2', 'governance', false, 'low'),
        node('gov3', 'governance', false, 'low'),
        node('a', 'general', false, 'low', 4),
      ]),
    );
    const atRisk = await generateDecisionBrief('org');
    expect(atRisk.currentStateAssessment).toContain('at risk');
    // 1 of 3 gov single source = 33% -> moderate concentration
    expect(atRisk.governanceExposureSummary).toContain('Moderate governance concentration');

    // adequate path + low governance concentration
    mocks.resilience.mockResolvedValue(resilienceIndex(70, 'adequate', []));
    mocks.buildMap.mockResolvedValue(
      propMap([
        node('gov1', 'governance', false, 'low'),
        node('gov2', 'governance', false, 'low'),
        node('gov3', 'governance', false, 'low'),
      ]),
    );
    const adequate = await generateDecisionBrief('org');
    expect(adequate.currentStateAssessment).toContain('adequate');
    expect(adequate.governanceExposureSummary).toContain('reasonably distributed');
  });
});
