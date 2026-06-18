import { describe, expect, it, vi } from 'vitest';

const { loadCognitionMemory } = vi.hoisted(() => ({ loadCognitionMemory: vi.fn() }));
vi.mock('@/lib/knowledge-transfer/cognition-memory/memory-store', () => ({ loadCognitionMemory }));

import { trackMitigationEffectiveness } from '../effectiveness-tracker';

function entry(o: { id: string; memoryType: string; day: number; score: number | null; tags?: string[] }) {
  return {
    id: o.id,
    title: `T-${o.id}`,
    memoryType: o.memoryType,
    createdAt: `2025-01-${String(o.day).padStart(2, '0')}T00:00:00.000Z`,
    resilienceScoreAtCapture: o.score,
    tags: o.tags ?? [],
    sessionId: 's',
  };
}

describe('lib/knowledge-transfer/mitigation-effectiveness/effectiveness-tracker', () => {
  it('measures effectiveness across verified, unverified, and ineffective interventions', async () => {
    loadCognitionMemory.mockResolvedValue({
      entries: [
        entry({ id: 'mit1', memoryType: 'mitigation_comparison', day: 1, score: 50, tags: ['documentation'] }),
        entry({ id: 'base1', memoryType: 'resilience_baseline', day: 5, score: 62 }), // +12 highly
        entry({ id: 'mit2', memoryType: 'continuity_assessment', day: 6, score: 62, tags: ['approved'] }),
        entry({ id: 'base2', memoryType: 'resilience_baseline', day: 10, score: 58 }), // -4 counterproductive
        entry({ id: 'mit3', memoryType: 'mitigation_comparison', day: 20, score: null, tags: ['training'] }), // unverified
      ],
      resilienceTimeline: [],
    } as never);

    const report = await trackMitigationEffectiveness('org-1');
    expect(report.outcomes.length).toBe(2);
    expect(report.unverifiedInterventions.length).toBe(1);
    expect(report.outcomes.some((o) => o.effectivenessRating === 'highly_effective')).toBe(true);
    expect(report.dimensionBreakdown.length).toBeGreaterThan(0);
    expect(report.mostEffectiveIntervention?.interventionId).toBe('mit1');
    expect(['highly_effective', 'moderately_effective', 'marginally_effective', 'ineffective', 'counterproductive', 'unverified']).toContain(report.overallEffectivenessRating);
    expect(report.continuityRecommendation.length).toBeGreaterThan(0);
  });

  it('returns unverified report when no follow-up data exists', async () => {
    loadCognitionMemory.mockResolvedValue({
      entries: [entry({ id: 'mit1', memoryType: 'mitigation_comparison', day: 1, score: null })],
      resilienceTimeline: [],
    } as never);
    const report = await trackMitigationEffectiveness('org-2');
    expect(report.overallEffectivenessRating).toBe('unverified');
    expect(report.averageResilienceGain).toBe(0);
    expect(report.mostEffectiveIntervention).toBeNull();
    expect(report.continuityRecommendation).toContain('Insufficient');
  });
});
