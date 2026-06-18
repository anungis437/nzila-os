import { describe, expect, it, vi } from 'vitest';

const { buildDependencyPropagationMap, calculateResilienceIndex } = vi.hoisted(() => ({
  buildDependencyPropagationMap: vi.fn(),
  calculateResilienceIndex: vi.fn(),
}));
vi.mock('../../propagation/dependency-propagator', () => ({ buildDependencyPropagationMap }));
vi.mock('../../resilience-index/resilience-calculator', () => ({ calculateResilienceIndex }));

import { buildResilienceRoadmap } from '../strategy-modeler';

function node(overrides: Record<string, unknown> = {}) {
  return { isSingleSource: false, category: 'operational', nodeType: 'process', ...overrides };
}

function resilienceIndex(score: number, docScore = 50) {
  return {
    overallScore: score,
    dimensions: [{ name: 'Documentation Maturity', score: docScore }],
  };
}

describe('lib/knowledge-transfer/resilience-strategies/strategy-modeler', () => {
  it('builds a full roadmap selecting many strategies for a fragile org', async () => {
    const nodes = [
      ...Array.from({ length: 6 }, () => node({ isSingleSource: true })),
      node({ category: 'governance', isSingleSource: true }),
      node({ category: 'governance', isSingleSource: false }),
      node({ category: 'vendor', isSingleSource: true }),
      node({ category: 'vendor', isSingleSource: false }),
      node({ nodeType: 'vendor', isSingleSource: true }),
      node(), node(), node(),
    ];
    buildDependencyPropagationMap.mockResolvedValue({ nodes });
    calculateResilienceIndex.mockResolvedValue(resilienceIndex(30, 40));

    const roadmap = await buildResilienceRoadmap('org-1');
    expect(roadmap.strategies.length).toBeGreaterThan(0);
    expect(roadmap.strategies.length).toBeLessThanOrEqual(5);
    expect(roadmap.projectedScore).toBeGreaterThanOrEqual(roadmap.currentScore);
    expect(roadmap.maturityNarrative).toContain('early');
    expect(roadmap.phase1QuickWins.length + roadmap.phase2Foundation.length + roadmap.phase3Sustained.length).toBeGreaterThan(0);
  });

  it('produces a minimal roadmap for a mature, well-distributed org', async () => {
    buildDependencyPropagationMap.mockResolvedValue({ nodes: [node(), node()] });
    calculateResilienceIndex.mockResolvedValue(resilienceIndex(80, 90));
    const roadmap = await buildResilienceRoadmap('org-2');
    expect(roadmap.maturityNarrative).toContain('strong');
    expect(Array.isArray(roadmap.strategies)).toBe(true);
  });

  it('covers developing and adequate maturity narratives', async () => {
    buildDependencyPropagationMap.mockResolvedValue({
      nodes: Array.from({ length: 12 }, () => node({ isSingleSource: true })),
    });
    calculateResilienceIndex.mockResolvedValue(resilienceIndex(50, 30));
    const dev = await buildResilienceRoadmap('org-3');
    expect(dev.maturityNarrative).toContain('developing');

    calculateResilienceIndex.mockResolvedValue(resilienceIndex(68, 30));
    const adq = await buildResilienceRoadmap('org-4');
    expect(adq.maturityNarrative).toContain('adequate');
  });
});
