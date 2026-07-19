/**
 * Continuity Impact Simulator — Unit Tests
 *
 * Drives simulateContinuityImpact across scenario types + the minimal/no-match
 * path, exercising baseline calc, domain impacts, weakness identification,
 * recommendation generation, projection, recovery effort, and executive summary.
 * Pure helpers from simulation-models are kept REAL.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SimulationScenario, SimulationType } from '../simulation-models';

const mocks = vi.hoisted(() => ({ buildMap: vi.fn(), interviews: [] as unknown[] }));

function makeChain() {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => Promise.resolve(mocks.interviews);
  return chain;
}

vi.mock('@/lib/knowledge-transfer/propagation/dependency-propagator', () => ({
  buildDependencyPropagationMap: mocks.buildMap,
}));
vi.mock('@/db/db', () => ({ db: { select: vi.fn(() => makeChain()) } }));
vi.mock('@/db/schema', () => ({ exitInterviews: { organizationId: 'organizationId', status: 'status' } }));
vi.mock('drizzle-orm', () => ({ and: (...a: unknown[]) => a, eq: (...a: unknown[]) => a }));

import { simulateContinuityImpact } from '../continuity-simulator';

function n(id: string, category: string, isSingleSource: boolean, roles = ['President']) {
  return {
    id, label: id, nodeType: category, category, frequency: isSingleSource ? 1 : 5,
    associatedRoles: roles, isSingleSource, continuitySensitivity: isSingleSource ? 'critical' : 'low',
    sensitivityReason: '',
  };
}

function mapWith(nodes: unknown[], bottlenecks: unknown[] = []) {
  return {
    organizationId: 'org', generatedAt: new Date().toISOString(),
    nodes, edges: [], downstreamImpacts: [], upstreamDependencies: [],
    couplingAnalysis: [], bottlenecks,
    resilience: { recommendations: [], priorityOrder: [], estimatedEffort: {} },
  };
}

function scenario(simulationType: SimulationType, affectedNodeIds: string[]): SimulationScenario {
  return { simulationType, affectedNodeIds };
}

describe('simulateContinuityImpact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.interviews = [];
  });

  it('returns a minimal simulation when no nodes match the scenario', async () => {
    mocks.interviews = [{ id: 'i1' }];
    mocks.buildMap.mockResolvedValue(mapWith([n('a', 'system', false)]));
    const result = await simulateContinuityImpact('org', scenario('retirement', ['nonexistent']));
    expect(result.overallImpactSeverity).toBe('low');
    expect(result.immediateImpactScore).toBe(20);
    expect(result.domainImpacts).toEqual([]);
    expect(result.executiveSummary).toContain('did not match');
  });

  it('simulates a critical multi-domain governance + vendor loss', async () => {
    mocks.interviews = [{ id: 'i1' }, { id: 'i2' }];
    mocks.buildMap.mockResolvedValue(
      mapWith(
        [
          n('gov', 'governance', true, ['President']),
          n('comp', 'compliance', true, ['Officer']),
          n('vend', 'vendor', true, ['Treasurer']),
          n('sys', 'system', true, ['Admin']),
        ],
        [{ nodeId: 'gov', reason: 'single_source', riskLevel: 'critical', affectedRoles: ['President'] }],
      ),
    );
    const result = await simulateContinuityImpact(
      'org',
      scenario('bottleneck_collapse', ['gov', 'comp', 'vend', 'sys']),
    );
    expect(result.domainImpacts.length).toBe(4);
    expect(result.exacerbatedWeaknesses.length).toBeGreaterThan(0);
    // single-source + governance + vendor weaknesses all produced
    const types = new Set(result.exacerbatedWeaknesses.map((w) => w.weaknessType));
    expect(types.has('single_source')).toBe(true);
    expect(types.has('governance_gap')).toBe(true);
    expect(types.has('vendor_dependency')).toBe(true);
    // recommendations across all horizons
    expect(result.immediateActions.length).toBeGreaterThan(0);
    expect(result.mitigation30Day.length).toBeGreaterThan(0);
    expect(result.remediation90Day.length).toBe(5);
    // governance + compliance flags
    expect(result.governanceBodiesAffected).toBe(1);
    expect(result.complianceRiskCreated).toBe(true);
    expect(['low', 'medium', 'high', 'extreme']).toContain(result.recoveryEffortEstimate);
    expect(result.autonomousRecoveryProbability).toBeGreaterThanOrEqual(0);
    expect(result.executiveSummary).toMatch(/CRITICAL|HIGH|MODERATE|LOW/);
    expect(['critical', 'high', 'medium', 'low']).toContain(result.overallImpactSeverity);
  });

  it('handles a well-documented org with redundant nodes (sudden_departure)', async () => {
    mocks.interviews = Array.from({ length: 10 }, (_, i) => ({ id: 'i' + i }));
    mocks.buildMap.mockResolvedValue(
      mapWith([n('sys1', 'system', false), n('sys2', 'system', false)]),
    );
    const result = await simulateContinuityImpact('org', scenario('sudden_departure', ['sys1', 'sys2']));
    expect(result.baselineContinuityScore).toBeGreaterThan(30);
    // redundant + well-documented -> no single-source weaknesses
    expect(result.exacerbatedWeaknesses.every((w) => w.weaknessType !== 'single_source')).toBe(true);
    // 30-day mitigations include system operator training
    expect(result.mitigation30Day.some((m) => m.includes('backup operators'))).toBe(true);
    expect(result.twelveWeekProjection).toBeGreaterThanOrEqual(0);
    expect(result.twelveWeekProjection).toBeLessThanOrEqual(100);
  });

  it('simulates vendor_loss with 30-day backup-vendor mitigation', async () => {
    mocks.interviews = Array.from({ length: 5 }, (_, i) => ({ id: 'i' + i }));
    mocks.buildMap.mockResolvedValue(mapWith([n('vend', 'vendor', false, ['Treasurer'])]));
    const result = await simulateContinuityImpact('org', scenario('vendor_loss', ['vend']));
    expect(result.mitigation30Day.some((m) => m.includes('backup vendors'))).toBe(true);
    expect(result.exacerbatedWeaknesses.some((w) => w.weaknessType === 'vendor_dependency')).toBe(true);
  });
});
