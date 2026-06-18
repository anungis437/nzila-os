import { describe, expect, it, vi } from 'vitest';

const { calculateResilienceIndex, loadCognitionMemory } = vi.hoisted(() => ({
  calculateResilienceIndex: vi.fn(),
  loadCognitionMemory: vi.fn(),
}));
vi.mock('@/lib/knowledge-transfer/resilience-index/resilience-calculator', () => ({ calculateResilienceIndex }));
vi.mock('@/lib/knowledge-transfer/cognition-memory/memory-store', () => ({ loadCognitionMemory }));

import { generateFederatedBenchmark } from '../federated-engine';

describe('lib/knowledge-transfer/federated-intelligence/federated-engine', () => {
  it('benchmarks a developing org with mixed dimensions and prior score', async () => {
    calculateResilienceIndex.mockResolvedValue({
      overallScore: 52,
      dimensions: [
        { name: 'Documentation Maturity', score: 60 },
        { name: 'Governance', score: 40 },
        { name: 'Redundancy', score: 48 },
      ],
    });
    loadCognitionMemory.mockResolvedValue({
      resilienceTimeline: [{ resilienceScore: 45 }, { resilienceScore: 52 }],
    } as never);

    const result = await generateFederatedBenchmark('org-1');
    expect(result.orgPosition.cohort).toBe('developing');
    expect(result.orgPosition.estimatedPercentile).toBeGreaterThan(0);
    expect(result.orgPosition.nextCohort).toBe('established');
    expect(result.dimensionComparisons.length).toBe(3);
    expect(result.dimensionComparisons.some((d) => d.relativePosition === 'above_cohort')).toBe(true);
    expect(result.dimensionComparisons.some((d) => d.relativePosition === 'below_cohort')).toBe(true);
    expect(result.maturityCurve.previousPosition).toBe(45);
    expect(result.cohortInsights.some((i) => i.includes('improved'))).toBe(true);
  });

  it('handles a leading org with no next cohort and no prior score', async () => {
    calculateResilienceIndex.mockResolvedValue({
      overallScore: 92,
      dimensions: [{ name: 'Governance', score: 93 }],
    });
    loadCognitionMemory.mockResolvedValue({ resilienceTimeline: [] } as never);
    const result = await generateFederatedBenchmark('org-2');
    expect(result.orgPosition.cohort).toBe('leading');
    expect(result.orgPosition.nextCohort).toBeNull();
    expect(result.orgPosition.pointsToNextCohort).toBe(0);
    expect(result.maturityCurve.previousPosition).toBeNull();
    expect(result.cohortInsights.some((i) => i.includes('leading-level'))).toBe(true);
  });

  it('handles a nascent org below the lowest reference percentile', async () => {
    calculateResilienceIndex.mockResolvedValue({
      overallScore: 8,
      dimensions: [{ name: 'Governance', score: 8 }],
    });
    loadCognitionMemory.mockResolvedValue({ resilienceTimeline: [{ resilienceScore: 12 }, { resilienceScore: 8 }] } as never);
    const result = await generateFederatedBenchmark('org-3');
    expect(result.orgPosition.cohort).toBe('nascent');
    expect(result.orgPosition.estimatedPercentile).toBe(5);
    expect(result.cohortInsights.some((i) => i.includes('declined'))).toBe(true);
  });
});
