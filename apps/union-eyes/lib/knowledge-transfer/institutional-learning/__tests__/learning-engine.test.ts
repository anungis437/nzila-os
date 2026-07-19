import { describe, expect, it, vi } from 'vitest';

const { loadCognitionMemory } = vi.hoisted(() => ({ loadCognitionMemory: vi.fn() }));
vi.mock('@/lib/knowledge-transfer/cognition-memory/memory-store', () => ({ loadCognitionMemory }));

import { analyzeInstitutionalLearning } from '../learning-engine';

function entry(id: string, memoryType: string, score: number, daysAgo: number) {
  return { id, memoryType, title: `e${id}`, resilienceScoreAtCapture: score, createdAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString() };
}
function tl(score: number, daysAgo: number, id: string) {
  return { resilienceScore: score, capturedAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString(), memoryEntryId: id, changeFromPrevious: null };
}

describe('lib/knowledge-transfer/institutional-learning/learning-engine', () => {
  it('extracts improvement, intervention, and rich-memory insights', async () => {
    const entries = [
      entry('a', 'mitigation_comparison', 30, 30),
      entry('b', 'mitigation_comparison', 40, 25),
      entry('c', 'governance_reasoning', 45, 20),
      entry('d', 'decision_brief', 55, 15),
      entry('e', 'continuity_assessment', 60, 10),
      entry('f', 'governance_reasoning', 65, 8),
      entry('g', 'decision_brief', 68, 6),
      entry('h', 'continuity_assessment', 70, 4),
      entry('i', 'governance_reasoning', 72, 3),
      entry('j', 'decision_brief', 75, 1),
    ];
    loadCognitionMemory.mockResolvedValue({
      entries,
      resilienceTimeline: [tl(40, 30, 'a'), tl(50, 20, 'c'), tl(58, 10, 'e'), tl(68, 1, 'j')],
    } as never);
    const report = await analyzeInstitutionalLearning('org-1');
    expect(report.entriesAnalyzed).toBe(10);
    expect(report.insights.some((i) => i.insightType === 'resilience_improvement')).toBe(true);
    expect(report.insights.some((i) => i.insightType === 'effective_intervention')).toBe(true);
    expect(report.insights.some((i) => i.insightType === 'governance_stabilization')).toBe(true);
    expect(report.resilienceEvolution.trend).toBe('improving');
    expect(report.maturityAssessment.maturityScore).toBeGreaterThan(0);
  });

  it('detects regression and volatility', async () => {
    loadCognitionMemory.mockResolvedValue({
      entries: [entry('a', 'governance_reasoning', 80, 20), entry('b', 'governance_reasoning', 30, 10), entry('c', 'governance_reasoning', 60, 5)],
      resilienceTimeline: [tl(80, 20, 'a'), tl(30, 10, 'b'), tl(60, 5, 'c'), tl(20, 1, 'd')],
    } as never);
    const report = await analyzeInstitutionalLearning('org-2');
    expect(report.resilienceEvolution.trend).toBe('volatile');
    expect(report.insights.some((i) => i.insightType === 'recurring_failure')).toBe(true);
  });

  it('handles regression-only trend', async () => {
    loadCognitionMemory.mockResolvedValue({
      entries: [entry('a', 'governance_reasoning', 60, 20), entry('b', 'governance_reasoning', 50, 1)],
      resilienceTimeline: [tl(60, 20, 'a'), tl(48, 1, 'b')],
    } as never);
    const report = await analyzeInstitutionalLearning('org-3');
    expect(report.resilienceEvolution.trend).toBe('declining');
    expect(report.insights.some((i) => i.insightType === 'resilience_regression')).toBe(true);
  });

  it('returns insufficient_data with empty store', async () => {
    loadCognitionMemory.mockResolvedValue({ entries: [], resilienceTimeline: [] } as never);
    const report = await analyzeInstitutionalLearning('org-4');
    expect(report.resilienceEvolution.trend).toBe('insufficient_data');
    expect(report.insights).toEqual([]);
    expect(report.maturityAssessment.maturityStage).toBe('nascent');
  });

  it('detects stagnation plateau', async () => {
    const entries = Array.from({ length: 5 }, (_, i) => entry(`e${i}`, 'governance_reasoning', 50, 20 - i * 3));
    loadCognitionMemory.mockResolvedValue({
      entries,
      resilienceTimeline: [tl(50, 20, 'e0'), tl(51, 15, 'e1'), tl(50, 10, 'e2'), tl(50, 5, 'e3'), tl(50, 1, 'e4')],
    } as never);
    const report = await analyzeInstitutionalLearning('org-5');
    expect(report.resilienceEvolution.trend).toBe('stable');
  });
});
