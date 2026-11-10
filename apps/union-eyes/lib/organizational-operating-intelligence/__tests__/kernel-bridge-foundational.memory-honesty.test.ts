import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * DEF-0B7-COGB-MEMORY-ENGINES-RESTATE-OFFICER-TYPED-ENTRIES-AS-MEASURED-CONDITION.
 *
 * The underlying engines (institutional-learning, learning-trajectory, maturity-personalities,
 * resilience-habits, mitigation-effectiveness) compute only from ue_cognition_memory rows an
 * officer types in, with an optional self-declared resilience score. This proves the envelope
 * these results actually reach a caller through (defineFoundationalEngine, via
 * kernel-bridge-foundational.ts) never restates that typed input as measured organizational
 * condition: confidence is always 0/"insufficient_data" (no engine here computes a validated
 * score), evidence cites only the real entry ids the payload itself names, and reasoning,
 * assumptions and governanceImplications stay empty rather than filled with fixed text the
 * computation did not produce - against seeded data that mixes scored and unscored entries, so
 * an absent score demonstrably does not inflate or fabricate confidence either.
 */

const { loadCognitionMemory, listReasoningSessions } = vi.hoisted(() => ({
  loadCognitionMemory: vi.fn(),
  listReasoningSessions: vi.fn(),
}));
vi.mock('@/lib/knowledge-transfer/cognition-memory/memory-store', () => ({ loadCognitionMemory }));
vi.mock('@/lib/knowledge-transfer/reasoning-sessions/session-manager', () => ({ listReasoningSessions }));

const ORG = 'org-memory-honesty';

function entry(id: string, memoryType: string, day: number, resilienceScoreAtCapture: number | null) {
  return {
    id,
    memoryType,
    title: `entry ${id}`,
    createdAt: `2025-02-${String(day).padStart(2, '0')}T00:00:00.000Z`,
    resilienceScoreAtCapture,
    sessionId: null,
  };
}

describe('kernel-bridge-foundational: memory-based engines never restate officer-typed entries as measured condition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadCognitionMemory.mockResolvedValue({
      organizationId: ORG,
      entries: [
        entry('e1', 'governance_reasoning', 1, 62),
        entry('e2', 'mitigation_comparison', 3, null), // no score typed - must not vanish from entriesAnalyzed
        entry('e3', 'resilience_baseline', 5, 70),
        entry('e4', 'decision_brief', 7, null),
        entry('e5', 'continuity_assessment', 9, 75),
      ],
      resilienceTimeline: [
        { capturedAt: '2025-02-01T00:00:00.000Z', resilienceScore: 62, memoryEntryId: 'e1', title: 'entry e1', changeFromPrevious: null },
        { capturedAt: '2025-02-05T00:00:00.000Z', resilienceScore: 70, memoryEntryId: 'e3', title: 'entry e3', changeFromPrevious: 8 },
        { capturedAt: '2025-02-09T00:00:00.000Z', resilienceScore: 75, memoryEntryId: 'e5', title: 'entry e5', changeFromPrevious: 5 },
      ],
      totalEntries: 5,
    });
    listReasoningSessions.mockResolvedValue([]);
  });

  it.each([
    ['institutionalLearningEngine', 'learning'],
    ['learningTrajectoryEngine', 'trajectory'],
    ['governancePersonalityEngine', 'personality'],
    ['resilienceHabitsEngine', 'habit'],
    ['mitigationEffectivenessEngine', 'mitigation'],
  ] as const)('%s (%s): confidence stays insufficient_data, evidence cites only real entry ids, no fixed reasoning/assumptions', async (exportName) => {
    const mod = await import('../kernel-bridge-foundational');
    const run = mod[exportName] as (orgId: string) => Promise<{
      confidence: string;
      evidence: Array<{ reference?: { kind: string; id: string } }>;
      reasoning: unknown[];
      assumptions: unknown[];
      governanceImplications: unknown[];
    }>;

    const envelope = await run(ORG);

    // Never a fabricated confidence: no engine wrapped here produces a validated score.
    expect(envelope.confidence).toBe('insufficient_data');
    // Never fixed boilerplate reasoning/assumptions/governance implications around a computation that did not produce them.
    expect(envelope.reasoning).toEqual([]);
    expect(envelope.assumptions).toEqual([]);
    expect(envelope.governanceImplications).toEqual([]);
    // Evidence, if any, names only real seeded entry ids - never a count-only claim standing in for a citation.
    const seededIds = new Set(['e1', 'e2', 'e3', 'e4', 'e5']);
    for (const item of envelope.evidence) {
      expect(item.reference?.kind).toBe('cognition_memory');
      expect(seededIds.has(item.reference!.id)).toBe(true);
    }
  });

  it('an entry with no typed resilience score is still counted as organizational memory, not erased by the scored-only timeline', async () => {
    const { analyzeInstitutionalLearning } = await import('../../knowledge-transfer/institutional-learning/learning-engine');
    const profile = await analyzeInstitutionalLearning(ORG);
    // 5 entries were typed in; 2 carry no resilience score. The unscored ones must still count as memory depth,
    // even though they cannot contribute a point to any resilience-score trend.
    expect(profile.entriesAnalyzed).toBe(5);
  });
});

