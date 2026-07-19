import { describe, expect, it, vi } from 'vitest';

const { loadCognitionMemory, listReasoningSessions } = vi.hoisted(() => ({
  loadCognitionMemory: vi.fn(),
  listReasoningSessions: vi.fn(),
}));
vi.mock('@/lib/knowledge-transfer/cognition-memory/memory-store', () => ({ loadCognitionMemory }));
vi.mock('@/lib/knowledge-transfer/reasoning-sessions/session-manager', () => ({ listReasoningSessions }));

import { profileGovernancePersonality } from '../personality-profiler';

function entry(memoryType: string) {
  return { memoryType, createdAt: new Date().toISOString() };
}

describe('lib/knowledge-transfer/maturity-personalities/personality-profiler', () => {
  it('profiles a progressive, improving organization', async () => {
    loadCognitionMemory.mockResolvedValue({
      entries: [
        entry('governance_reasoning'), entry('governance_reasoning'), entry('decision_brief'),
        entry('mitigation_comparison'), entry('mitigation_comparison'),
        entry('continuity_assessment'), entry('continuity_assessment'), entry('continuity_assessment'),
      ],
      resilienceTimeline: [{ resilienceScore: 40 }, { resilienceScore: 50 }, { resilienceScore: 60 }],
    } as never);
    listReasoningSessions.mockResolvedValue([{}, {}, {}, {}]);
    const p = await profileGovernancePersonality('org-1');
    expect(p.personalityType).toBe('continuity_progressive');
    expect(p.maturityScore).toBeGreaterThan(0);
    expect(p.dimensions.length).toBe(5);
    expect(p.stabilityProfile.stabilityRating).toBeTruthy();
  });

  it('profiles a fragile organization with no history', async () => {
    loadCognitionMemory.mockResolvedValue({ entries: [], resilienceTimeline: [] } as never);
    listReasoningSessions.mockResolvedValue([]);
    const p = await profileGovernancePersonality('org-2');
    expect(p.personalityType).toBe('resilience_fragile');
    expect(p.stabilityProfile.stabilityRating).toBe('insufficient_data');
  });

  it('profiles a centralized governance organization (low volatility, high gov)', async () => {
    loadCognitionMemory.mockResolvedValue({
      entries: [
        entry('governance_reasoning'), entry('governance_reasoning'), entry('governance_reasoning'),
        entry('decision_brief'), entry('decision_brief'),
      ],
      resilienceTimeline: [{ resilienceScore: 50 }, { resilienceScore: 51 }, { resilienceScore: 50 }],
    } as never);
    listReasoningSessions.mockResolvedValue([]);
    const p = await profileGovernancePersonality('org-3');
    expect(p.personalityType).toBe('centralized_governance');
  });

  it('profiles a declining/volatile organization', async () => {
    loadCognitionMemory.mockResolvedValue({
      entries: [entry('continuity_assessment'), entry('continuity_assessment'), entry('continuity_assessment')],
      resilienceTimeline: [{ resilienceScore: 80 }, { resilienceScore: 30 }, { resilienceScore: 70 }, { resilienceScore: 20 }],
    } as never);
    listReasoningSessions.mockResolvedValue([]);
    const p = await profileGovernancePersonality('org-4');
    expect(['resilience_fragile', 'continuity_reactive']).toContain(p.personalityType);
    expect(p.identityStatement).toContain('"');
  });
});
