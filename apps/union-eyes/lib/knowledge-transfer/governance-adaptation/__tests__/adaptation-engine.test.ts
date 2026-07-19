import { describe, expect, it, vi } from 'vitest';

const { loadCognitionMemory, listReasoningSessions } = vi.hoisted(() => ({
  loadCognitionMemory: vi.fn(),
  listReasoningSessions: vi.fn(),
}));
vi.mock('@/lib/knowledge-transfer/cognition-memory/memory-store', () => ({ loadCognitionMemory }));
vi.mock('@/lib/knowledge-transfer/reasoning-sessions/session-manager', () => ({ listReasoningSessions }));

import { analyzeGovernanceAdaptation } from '../adaptation-engine';

function entry(id: string, memoryType: string, daysAgo = 1) {
  return {
    id,
    memoryType,
    title: `entry ${id}`,
    resilienceScoreAtCapture: 50,
    createdAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
    sessionId: null,
  };
}
function session(id: string, daysAgo = 1) {
  return {
    id,
    title: `session ${id}`,
    focus: 'governance',
    latestResilienceScore: 50,
    createdAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
  };
}
function tl(change: number | null, score: number, id: string, daysAgo = 1) {
  return { changeFromPrevious: change, resilienceScore: score, capturedAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString(), memoryEntryId: id };
}

describe('lib/knowledge-transfer/governance-adaptation/adaptation-engine', () => {
  it('detects actively adapting org with improvement and failure patterns', async () => {
    loadCognitionMemory.mockResolvedValue({
      entries: [entry('a', 'governance_reasoning', 10), entry('b', 'mitigation_comparison', 8), entry('c', 'resilience_baseline', 6), entry('d', 'decision_brief', 4)],
      resilienceTimeline: [
        tl(null, 40, 'a', 12),
        tl(8, 48, 'b', 9),
        tl(7, 55, 'c', 5),
        tl(6, 61, 'f', 4),
        tl(-6, 55, 'd', 3),
        tl(-7, 48, 'e', 2),
      ],
    } as never);
    listReasoningSessions.mockResolvedValue([session('s1', 11), session('s2', 7)]);

    const report = await analyzeGovernanceAdaptation('org-1');
    expect(report.adaptationHealth).toBe('actively_adapting');
    expect(report.recurringPatterns.some((p) => p.patternType === 'successful_adaptation')).toBe(true);
    expect(report.recurringPatterns.some((p) => p.patternType === 'recurring_failure')).toBe(true);
    expect(report.adaptationTimeline.totalEvents).toBeGreaterThan(0);
  });

  it('returns insufficient_history for sparse data', async () => {
    loadCognitionMemory.mockResolvedValue({ entries: [entry('a', 'memory_captured')], resilienceTimeline: [] } as never);
    listReasoningSessions.mockResolvedValue([]);
    const report = await analyzeGovernanceAdaptation('org-2');
    expect(report.adaptationHealth).toBe('insufficient_history');
    expect(report.adaptationTimeline.progressionNarrative).toContain('Insufficient');
  });

  it('detects stagnation with sessions but no improvements', async () => {
    loadCognitionMemory.mockResolvedValue({
      entries: [entry('a', 'memory_captured', 5), entry('b', 'memory_captured', 4)],
      resilienceTimeline: [],
    } as never);
    listReasoningSessions.mockResolvedValue([session('s1', 6), session('s2', 5), session('s3', 4)]);
    const report = await analyzeGovernanceAdaptation('org-3');
    expect(report.recurringPatterns.some((p) => p.patternType === 'stagnation')).toBe(true);
    expect(['stagnant', 'slowly_adapting']).toContain(report.adaptationHealth);
  });
});
