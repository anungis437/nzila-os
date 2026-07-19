import { describe, expect, it, vi } from 'vitest';

const { loadCognitionMemory, buildResilienceRoadmap } = vi.hoisted(() => ({
  loadCognitionMemory: vi.fn(),
  buildResilienceRoadmap: vi.fn(),
}));
vi.mock('@/lib/knowledge-transfer/cognition-memory/memory-store', () => ({ loadCognitionMemory }));
vi.mock('@/lib/knowledge-transfer/resilience-strategies/strategy-modeler', () => ({ buildResilienceRoadmap }));

import { computeAdaptiveResilience } from '../adaptive-engine';

function strategy(strategyType: string, name: string, gain = 18) {
  return { strategyType, name, projectedResilienceGain: gain };
}

function memEntry(id: string, memoryType: string, tags: string[] = [], title = '') {
  return { id, memoryType, tags, title, createdAt: new Date().toISOString() };
}

describe('lib/knowledge-transfer/adaptive-resilience/adaptive-engine', () => {
  it('elevates historically-effective strategies with rich history', async () => {
    loadCognitionMemory.mockResolvedValue({
      entries: [
        memEntry('a', 'mitigation_comparison', ['documentation_foundation']),
        memEntry('b', 'mitigation_comparison', [], 'documentation_foundation rollout'),
        memEntry('c', 'continuity_assessment'),
        memEntry('d', 'governance_reasoning'),
        memEntry('e', 'governance_reasoning'),
        memEntry('f', 'decision_brief'),
        memEntry('g', 'decision_brief'),
        memEntry('h', 'mitigation_comparison'),
        memEntry('i', 'mitigation_comparison'),
        memEntry('j', 'mitigation_comparison'),
      ],
      resilienceTimeline: [
        { changeFromPrevious: null, memoryEntryId: 'a' },
        { changeFromPrevious: 5, memoryEntryId: 'b' },
        { changeFromPrevious: 4, memoryEntryId: 'c' },
        { changeFromPrevious: 6, memoryEntryId: 'd' },
      ],
    } as never);
    buildResilienceRoadmap.mockResolvedValue({
      strategies: [strategy('documentation_foundation', 'Documentation Foundation'), strategy('knowledge_decentralization', 'Knowledge Decentralization')],
    });

    const result = await computeAdaptiveResilience('org-1');
    expect(result.adaptedRecommendations.length).toBe(2);
    expect(result.adaptationSummary.overallConfidence).toBe('high');
    expect(result.adaptationSummary.elevatedCount).toBeGreaterThanOrEqual(1);
    expect(result.adaptationNarrative).toContain('cognition entries');
  });

  it('leaves recommendations unadjusted with insufficient history', async () => {
    loadCognitionMemory.mockResolvedValue({ entries: [memEntry('a', 'mitigation_comparison')], resilienceTimeline: [] } as never);
    buildResilienceRoadmap.mockResolvedValue({ strategies: [strategy('documentation_foundation', 'Documentation Foundation')] });
    const result = await computeAdaptiveResilience('org-2');
    expect(result.adaptationSummary.unadjustedCount).toBe(1);
    expect(result.adaptationNarrative).toContain('Insufficient');
    expect(result.adaptationSummary.overallConfidence).toBe('insufficient_history');
  });

  it('deprioritizes unproven approaches when decline dominates', async () => {
    loadCognitionMemory.mockResolvedValue({
      entries: [
        memEntry('a', 'governance_reasoning'),
        memEntry('b', 'governance_reasoning'),
        memEntry('c', 'governance_reasoning'),
        memEntry('d', 'governance_reasoning'),
        memEntry('e', 'governance_reasoning'),
      ],
      resilienceTimeline: [
        { changeFromPrevious: -10, memoryEntryId: 'a' },
        { changeFromPrevious: -8, memoryEntryId: 'b' },
        { changeFromPrevious: -5, memoryEntryId: 'c' },
      ],
    } as never);
    buildResilienceRoadmap.mockResolvedValue({ strategies: [strategy('operational_redundancy', 'Operational Redundancy')] });
    const result = await computeAdaptiveResilience('org-3');
    expect(result.adaptationSummary.deprioritizedCount).toBeGreaterThanOrEqual(1);
  });
});
