import { describe, expect, it, vi } from 'vitest';

const { loadCognitionMemory, listReasoningSessions } = vi.hoisted(() => ({
  loadCognitionMemory: vi.fn(),
  listReasoningSessions: vi.fn(),
}));
vi.mock('@/lib/knowledge-transfer/cognition-memory/memory-store', () => ({ loadCognitionMemory }));
vi.mock('@/lib/knowledge-transfer/reasoning-sessions/session-manager', () => ({ listReasoningSessions }));

import { classifyLearningArchetype } from '../archetype-classifier';

const DAY = 86_400_000;

describe('lib/knowledge-transfer/learning-archetypes/archetype-classifier', () => {
  it('classifies a rich, improving organization with secondary archetype', async () => {
    const base = Date.now();
    const entries = [
      { memoryType: 'governance_reasoning', createdAt: new Date(base - 300 * DAY).toISOString() },
      { memoryType: 'governance_reasoning', createdAt: new Date(base - 200 * DAY).toISOString() },
      { memoryType: 'decision_brief', createdAt: new Date(base - 3 * DAY).toISOString() },
      { memoryType: 'decision_brief', createdAt: new Date(base - 1 * DAY).toISOString() },
      { memoryType: 'mitigation_comparison', createdAt: new Date(base - 10 * DAY).toISOString() },
      { memoryType: 'mitigation_comparison', createdAt: new Date(base - 9 * DAY).toISOString() },
      { memoryType: 'mitigation_comparison', createdAt: new Date(base - 8 * DAY).toISOString() },
    ];
    const resilienceTimeline = [
      { resilienceScore: 40 },
      { resilienceScore: 45 },
      { resilienceScore: 52 },
      { resilienceScore: 58 },
    ];
    loadCognitionMemory.mockResolvedValue({ entries, resilienceTimeline } as never);
    listReasoningSessions.mockResolvedValue([{}, {}, {}]);

    const result = await classifyLearningArchetype('org-1');
    expect(result.primaryArchetype).toBeDefined();
    expect(result.archetypeFits.length).toBe(8);
    expect(result.classificationEvidence.length).toBeGreaterThan(0);
    expect(result.classificationConfidence).toBeGreaterThan(0);
  });

  it('classifies a stagnant organization with no history', async () => {
    loadCognitionMemory.mockResolvedValue({ entries: [], resilienceTimeline: [] } as never);
    listReasoningSessions.mockResolvedValue([]);
    const result = await classifyLearningArchetype('org-2');
    expect(result.primaryArchetype.id).toBe('governance_stagnant');
    expect(result.secondaryArchetype).toBeNull();
    expect(result.classificationEvidence.length).toBe(0);
  });

  it('handles a volatile organization', async () => {
    loadCognitionMemory.mockResolvedValue({
      entries: [{ memoryType: 'mitigation_comparison', createdAt: new Date().toISOString() }],
      resilienceTimeline: [{ resilienceScore: 10 }, { resilienceScore: 80 }, { resilienceScore: 20 }, { resilienceScore: 70 }],
    } as never);
    listReasoningSessions.mockResolvedValue([{}, {}]);
    const result = await classifyLearningArchetype('org-3');
    expect(result.evolutionContext).toBeTruthy();
  });
});
