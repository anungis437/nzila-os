import { describe, expect, it, vi } from 'vitest';

const { loadCognitionMemory, listReasoningSessions } = vi.hoisted(() => ({
  loadCognitionMemory: vi.fn(),
  listReasoningSessions: vi.fn(),
}));
vi.mock('@/lib/knowledge-transfer/cognition-memory/memory-store', () => ({ loadCognitionMemory }));
vi.mock('@/lib/knowledge-transfer/reasoning-sessions/session-manager', () => ({ listReasoningSessions }));

import { detectBehaviorPatterns } from '../behavior-engine';

const DAY = 86_400_000;

function store(overrides: Record<string, unknown> = {}) {
  return { entries: [], resilienceTimeline: [], ...overrides } as never;
}

describe('lib/knowledge-transfer/behavior-patterns/behavior-engine', () => {
  it('detects multiple patterns from a rich store', async () => {
    const base = Date.now();
    const entries = [
      // accelerating governance documentation (4 entries: first half wide, second half dense)
      { memoryType: 'governance_reasoning', createdAt: new Date(base - 200 * DAY).toISOString() },
      { memoryType: 'governance_reasoning', createdAt: new Date(base - 100 * DAY).toISOString() },
      { memoryType: 'decision_brief', createdAt: new Date(base - 2 * DAY).toISOString() },
      { memoryType: 'decision_brief', createdAt: new Date(base - 1 * DAY).toISOString() },
      // assessments without mitigations → avoidance
      { memoryType: 'continuity_assessment', createdAt: new Date(base - 50 * DAY).toISOString() },
      { memoryType: 'continuity_assessment', createdAt: new Date(base - 40 * DAY).toISOString() },
      { memoryType: 'continuity_assessment', createdAt: new Date(base - 30 * DAY).toISOString() },
    ];
    const resilienceTimeline = [
      { resilienceScore: 40, changeFromPrevious: null, capturedAt: new Date(base - 5 * DAY).toISOString() },
      { resilienceScore: 35, changeFromPrevious: -5, capturedAt: new Date(base - 4 * DAY).toISOString() },
      { resilienceScore: 50, changeFromPrevious: 15, capturedAt: new Date(base - 3 * DAY).toISOString() },
      { resilienceScore: 55, changeFromPrevious: 5, capturedAt: new Date(base - 2 * DAY).toISOString() },
      { resilienceScore: 60, changeFromPrevious: 5, capturedAt: new Date(base - 1 * DAY).toISOString() },
    ];
    loadCognitionMemory.mockResolvedValue(store({ entries, resilienceTimeline }));
    listReasoningSessions.mockResolvedValue([]);

    const report = await detectBehaviorPatterns('org-1');
    expect(report.patterns.length).toBeGreaterThanOrEqual(2);
    expect(report.dominantPattern).not.toBeNull();
    expect(report.behaviorNarrative).toContain('primary');
    expect(report.learningSignal).toBe('periodic_learning');
  });

  it('flags governance stagnation when there is no history', async () => {
    loadCognitionMemory.mockResolvedValue(store());
    listReasoningSessions.mockResolvedValue([]);
    const report = await detectBehaviorPatterns('org-2');
    expect(report.dominantPattern).toBe('governance_stagnation');
    expect(report.learningSignal).toBe('insufficient_history');
  });

  it('produces an empty-pattern narrative when active but featureless', async () => {
    const base = Date.now();
    const entries = Array.from({ length: 5 }, (_, i) => ({
      memoryType: 'other',
      createdAt: new Date(base - i * DAY).toISOString(),
    }));
    loadCognitionMemory.mockResolvedValue(store({ entries, resilienceTimeline: [] }));
    listReasoningSessions.mockResolvedValue([]);
    const report = await detectBehaviorPatterns('org-3');
    expect(report.patterns.length).toBe(0);
    expect(report.behaviorNarrative).toContain('Insufficient');
  });
});
