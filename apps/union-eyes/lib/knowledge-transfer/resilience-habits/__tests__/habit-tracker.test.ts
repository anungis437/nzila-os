import { describe, expect, it, vi } from 'vitest';

const { loadCognitionMemory, listReasoningSessions } = vi.hoisted(() => ({
  loadCognitionMemory: vi.fn(),
  listReasoningSessions: vi.fn(),
}));
vi.mock('@/lib/knowledge-transfer/cognition-memory/memory-store', () => ({ loadCognitionMemory }));
vi.mock('@/lib/knowledge-transfer/reasoning-sessions/session-manager', () => ({ listReasoningSessions }));

import { trackResilienceHabits } from '../habit-tracker';

function entry(memoryType: string, day: number) {
  return { id: `e-${memoryType}-${day}`, memoryType, createdAt: `2025-01-${String(day).padStart(2, '0')}T00:00:00.000Z`, title: 't', sessionId: 's' };
}

describe('lib/knowledge-transfer/resilience-habits/habit-tracker', () => {
  it('tracks habits for an active improving organization', async () => {
    const entries = [
      ...Array.from({ length: 6 }, (_, i) => entry('governance_reasoning', i + 1)),
      ...Array.from({ length: 4 }, (_, i) => entry('decision_brief', i + 8)),
      ...Array.from({ length: 5 }, (_, i) => entry('mitigation_comparison', i + 12)),
      ...Array.from({ length: 5 }, (_, i) => entry('continuity_assessment', i + 17)),
      ...Array.from({ length: 5 }, (_, i) => entry('resilience_baseline', i + 22)),
    ];
    loadCognitionMemory.mockResolvedValue({
      entries,
      resilienceTimeline: [
        { resilienceScore: 50, changeFromPrevious: null, capturedAt: 'a', memoryEntryId: '1' },
        { resilienceScore: 46, changeFromPrevious: -4, capturedAt: 'b', memoryEntryId: '2' },
        { resilienceScore: 52, changeFromPrevious: 6, capturedAt: 'c', memoryEntryId: '3' },
        { resilienceScore: 55, changeFromPrevious: 3, capturedAt: 'd', memoryEntryId: '4' },
        { resilienceScore: 58, changeFromPrevious: 3, capturedAt: 'e', memoryEntryId: '5' },
        { resilienceScore: 60, changeFromPrevious: 2, capturedAt: 'f', memoryEntryId: '6' },
        { resilienceScore: 62, changeFromPrevious: 2, capturedAt: 'g', memoryEntryId: '7' },
      ],
    } as never);
    listReasoningSessions.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, createdAt: `2025-02-0${i + 1}T00:00:00.000Z` })),
    );

    const profile = await trackResilienceHabits('org-1');
    expect(profile.dimensions.length).toBe(6);
    expect(profile.overallHabitScore).toBeGreaterThan(0);
    expect(['strong', 'developing', 'emerging', 'absent']).toContain(profile.overallTier);
    expect(profile.consistencyScore).toBeGreaterThanOrEqual(0);
    expect(profile.entriesAnalyzed).toBe(entries.length);
    expect(profile.habitNarrative).toContain('habit score');
  });

  it('handles an organization with no history', async () => {
    loadCognitionMemory.mockResolvedValue({ entries: [], resilienceTimeline: [] } as never);
    listReasoningSessions.mockResolvedValue([]);
    const profile = await trackResilienceHabits('org-2');
    expect(profile.overallHabitScore).toBe(0);
    expect(profile.overallTier).toBe('absent');
    expect(profile.strongestHabit).toBeNull();
    expect(profile.developmentPriority).not.toBeNull();
  });

  it('detects volatile declining history without governance response', async () => {
    loadCognitionMemory.mockResolvedValue({
      entries: [entry('memory_captured', 1), entry('memory_captured', 40)],
      resilienceTimeline: [
        { resilienceScore: 80, changeFromPrevious: null, capturedAt: 'a', memoryEntryId: '1' },
        { resilienceScore: 40, changeFromPrevious: -40, capturedAt: 'b', memoryEntryId: '2' },
        { resilienceScore: 20, changeFromPrevious: -20, capturedAt: 'c', memoryEntryId: '3' },
      ],
    } as never);
    listReasoningSessions.mockResolvedValue([]);
    const profile = await trackResilienceHabits('org-3');
    expect(profile.dimensions.find((d) => d.dimension === 'continuity_planning')).toBeDefined();
    expect(profile.overallHabitScore).toBeGreaterThanOrEqual(0);
  });
});
