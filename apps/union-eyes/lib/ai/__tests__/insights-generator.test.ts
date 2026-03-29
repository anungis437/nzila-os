import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSelectChain } = vi.hoisted(() => ({
  mockSelectChain: vi.fn(() => []),
}));

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => mockSelectChain()),
          })),
        })),
      })),
    })),
  },
}));

vi.mock('@/db/schema', () => ({
  analyticsMetrics: { organizationId: 'organizationId', periodStart: 'periodStart' },
  trendAnalyses: { organizationId: 'organizationId' },
  insightRecommendations: { organizationId: 'organizationId' },
  mlPredictions: { organizationId: 'organizationId' },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

import { generateInsights } from '../insights-generator';

describe('generateInsights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectChain.mockReturnValue([]);
  });

  it('returns empty array when no data', async () => {
    const insights = await generateInsights({
      organizationId: 'org-1',
      analysisType: 'metrics',
    });
    expect(insights).toEqual([]);
  });

  it('handles comprehensive type', async () => {
    const insights = await generateInsights({
      organizationId: 'org-1',
      analysisType: 'comprehensive',
    });
    expect(Array.isArray(insights)).toBe(true);
  });

  it('handles trends type', async () => {
    const insights = await generateInsights({
      organizationId: 'org-1',
      analysisType: 'trends',
    });
    expect(Array.isArray(insights)).toBe(true);
  });

  it('handles anomalies type', async () => {
    const insights = await generateInsights({
      organizationId: 'org-1',
      analysisType: 'anomalies',
    });
    expect(Array.isArray(insights)).toBe(true);
  });

  it('handles predictions type', async () => {
    const insights = await generateInsights({
      organizationId: 'org-1',
      analysisType: 'predictions',
    });
    expect(Array.isArray(insights)).toBe(true);
  });

  it('returns empty array on error', async () => {
    mockSelectChain.mockImplementation(() => { throw new Error('DB error'); });
    const insights = await generateInsights({
      organizationId: 'org-1',
      analysisType: 'metrics',
    });
    expect(insights).toEqual([]);
  });
});
