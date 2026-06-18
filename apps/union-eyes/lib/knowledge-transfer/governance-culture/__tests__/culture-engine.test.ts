import { describe, expect, it, vi } from 'vitest';

const { loadCognitionMemory, listReasoningSessions } = vi.hoisted(() => ({
  loadCognitionMemory: vi.fn(),
  listReasoningSessions: vi.fn(),
}));
vi.mock('@/lib/knowledge-transfer/cognition-memory/memory-store', () => ({ loadCognitionMemory }));
vi.mock('@/lib/knowledge-transfer/reasoning-sessions/session-manager', () => ({ listReasoningSessions }));

import { analyzeGovernanceCulture } from '../culture-engine';

function entry(memoryType: string, day: number) {
  return { id: `e-${memoryType}-${day}`, memoryType, createdAt: `2025-01-${String(day).padStart(2, '0')}T00:00:00.000Z`, title: 't', sessionId: 's' };
}
function tl(score: number, day: number) {
  return { resilienceScore: score, changeFromPrevious: null, capturedAt: `2025-01-${String(day).padStart(2, '0')}T00:00:00.000Z`, memoryEntryId: `${day}` };
}

describe('lib/knowledge-transfer/governance-culture/culture-engine', () => {
  it('profiles an active improving governance culture with evolution phases', async () => {
    loadCognitionMemory.mockResolvedValue({
      entries: [
        ...Array.from({ length: 4 }, (_, i) => entry('governance_reasoning', i + 1)),
        ...Array.from({ length: 2 }, (_, i) => entry('decision_brief', i + 5)),
        ...Array.from({ length: 4 }, (_, i) => entry('mitigation_comparison', i + 7)),
      ],
      resilienceTimeline: [tl(45, 1), tl(48, 3), tl(52, 5), tl(55, 7), tl(58, 9), tl(60, 11)],
    } as never);
    listReasoningSessions.mockResolvedValue(
      Array.from({ length: 3 }, (_, i) => ({ id: `s${i}`, createdAt: `2025-01-0${i + 2}T00:00:00.000Z` })),
    );

    const profile = await analyzeGovernanceCulture('org-1');
    expect(profile.entriesAnalyzed).toBe(10);
    expect(profile.indicators.length).toBeGreaterThan(0);
    expect(profile.evolutionPhases.length).toBeGreaterThan(0);
    expect(profile.cultureScore).toBeGreaterThan(0);
    expect(profile.disciplineProfile.documentationDiscipline).toBe('consistent');
    expect(profile.disciplineProfile.mitigationFollowThrough).toBe('strong');
    expect(profile.cultureSummary).toContain('Governance culture score');
  });

  it('detects declining culture', async () => {
    loadCognitionMemory.mockResolvedValue({
      entries: Array.from({ length: 5 }, (_, i) => entry('mitigation_comparison', i + 1)),
      resilienceTimeline: [tl(70, 1), tl(60, 5), tl(50, 9), tl(45, 12)],
    } as never);
    listReasoningSessions.mockResolvedValue([]);
    const profile = await analyzeGovernanceCulture('org-2');
    expect(profile.indicators.some((i) => i.dimension === 'Resilience Trajectory')).toBe(true);
  });

  it('handles a nascent organization with no history', async () => {
    loadCognitionMemory.mockResolvedValue({ entries: [], resilienceTimeline: [] } as never);
    listReasoningSessions.mockResolvedValue([]);
    const profile = await analyzeGovernanceCulture('org-3');
    expect(profile.dominantPosture).toBe('nascent_governance');
    expect(profile.cultureHealth).toBe('insufficient_history');
    expect(profile.evolutionPhases).toEqual([]);
    expect(profile.disciplineProfile.documentationDiscipline).toBe('absent');
  });
});
