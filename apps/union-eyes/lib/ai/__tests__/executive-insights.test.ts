import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGenerate, mockInsertValues, mockSelectChain: _mockSelectChain } = vi.hoisted(() => ({
  mockGenerate: vi.fn(),
  mockInsertValues: vi.fn(),
  mockSelectChain: vi.fn(() => []),
}));

vi.mock('@/db/db', () => ({
  db: {
    insert: vi.fn(() => ({ values: mockInsertValues })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => [{ value: 0 }]),
      })),
    })),
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/ai/ai-client', () => ({
  getAiClient: vi.fn(() => ({ generate: mockGenerate })),
  UE_APP_KEY: 'union-eyes',
  UE_PROFILES: { EXECUTIVE_INSIGHTS: 'ue-executive-insights' },
  UE_SYSTEM_ORG_ID: '00000000-0000-0000-0000-000000000000',
}));

vi.mock('@/db/schema/domains/ml/ai-insight-reports', () => ({
  aiInsightReports: { id: 'id' },
}));

vi.mock('@/db/schema/domains/claims/grievances', () => ({
  grievances: { id: 'id', organizationId: 'organizationId', createdAt: 'createdAt' },
}));

vi.mock('@/db/schema/domains/compliance/employer-compliance', () => ({
  employers: { id: 'id' },
  complianceAlerts: { id: 'id' },
}));

vi.mock('./ai-feature-guard', () => ({
  auditAiInteraction: vi.fn(async () => 'ai-insight-ref-123'),
  buildAiEnvelope: vi.fn((data: unknown, meta: Record<string, unknown>) => ({
    available: true, data, ...meta, disclaimer: 'AI disclaimer',
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { generateInsightReport } from '../executive-insights';
import type { InsightReportType, InsightTimeframe } from '../executive-insights';

describe('generateInsightReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerate.mockResolvedValue({
      content: JSON.stringify({
        title: 'Trend Forecast',
        summary: 'Grievance volume is stable',
        insights: [],
        predictions: [],
        recommendations: [],
        confidence: 0.72,
        explanation: 'Based on historical data...',
      }),
    });
    mockInsertValues.mockResolvedValue(undefined);
  });

  it('returns an AI envelope with insight result', async () => {
    const result = await generateInsightReport({
      reportType: 'trend_forecast' as InsightReportType,
      timeframe: '30d' as InsightTimeframe,
      organizationId: 'org-1',
      userId: 'user-1',
    });
    expect(result.available).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('calls AI generate', async () => {
    await generateInsightReport({
      reportType: 'executive_summary' as InsightReportType,
      timeframe: '90d' as InsightTimeframe,
      organizationId: 'org-1',
      userId: 'user-1',
    });
    expect(mockGenerate).toHaveBeenCalledOnce();
  });
});
