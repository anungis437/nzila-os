import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGenerate, mockInsertValues, mockCountWhere, mockFindMany, withRls, sharedDbUse } = vi.hoisted(() => ({
  mockGenerate: vi.fn(),
  mockInsertValues: vi.fn(),
  mockCountWhere: vi.fn(),
  mockFindMany: vi.fn(),
  withRls: vi.fn(),
  sharedDbUse: vi.fn(),
}));

// The shared connection is not tenant-scoped: the service must never read or write through it, and a test asserts that.
vi.mock('@/db/db', () => ({
  db: {
    insert: vi.fn(() => ({ values: sharedDbUse })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: sharedDbUse,
      })),
    })),
    query: { aiInsightReports: { findMany: sharedDbUse } },
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/ai/ai-client', () => ({
  toGatewayDataClass: vi.fn((dataClass: string) => dataClass),
  getAiClient: vi.fn(() => ({ generate: mockGenerate })),
  buildOrgAiTrace: vi.fn(() => ({
    component: 'test',
    action: 'mock',
  })),
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

vi.mock('@/lib/ai/ai-feature-guard', () => ({
  auditAiInteraction: vi.fn(async () => 'ai-insight-ref-123'),
  buildAiEnvelope: vi.fn((data: any, meta: Record<string, unknown>) => ({
    available: true, data, ...meta, disclaimer: 'AI disclaimer',
  })),
}));

vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: withRls }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn(async () => undefined) }));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { generateInsightReport, getInsightReports, getLatestInsightReports } from '../executive-insights';
import type { InsightReportType, InsightTimeframe } from '../executive-insights';

// The tenant transaction every service call runs its reads in
const tenantTx = () => ({
  select: () => ({ from: () => ({ where: mockCountWhere }) }),
  insert: () => ({ values: mockInsertValues }),
  query: { aiInsightReports: { findMany: mockFindMany } },
});

describe('generateInsightReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withRls.mockImplementation(async (_scope: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(tenantTx()));
    mockCountWhere.mockResolvedValue([{ value: 0 }]);
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
    // Generating a report materializes nothing
    expect(mockInsertValues).not.toHaveBeenCalled();
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

  it('counts the organization\'s own records in its own context before the provider is called, never through the shared connection', async () => {
    await generateInsightReport({
      reportType: 'trend_forecast' as InsightReportType,
      timeframe: '30d' as InsightTimeframe,
      organizationId: 'org-1',
      userId: 'user-1',
    });
    expect(withRls.mock.calls[0][0]).toEqual({ organizationId: 'org-1' });
    expect(mockCountWhere).toHaveBeenCalledTimes(5);
    expect(withRls.mock.invocationCallOrder[0]).toBeLessThan(mockGenerate.mock.invocationCallOrder[0]);
    expect(sharedDbUse).not.toHaveBeenCalled();
  });
});

describe('insight report reads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withRls.mockImplementation(async (_scope: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(tenantTx()));
  });

  it('lists the organization\'s reports in its own context, never through the shared connection', async () => {
    mockFindMany.mockResolvedValue([{ id: 'report-1' }]);
    await expect(getInsightReports('org-1', 'trend_forecast' as InsightReportType, 3)).resolves.toEqual([{ id: 'report-1' }]);
    expect(withRls).toHaveBeenCalledWith({ organizationId: 'org-1' }, expect.any(Function));
    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ limit: 3 }));
    expect(sharedDbUse).not.toHaveBeenCalled();
  });

  it('joins the caller\'s transaction instead of opening another when given one', async () => {
    mockFindMany.mockResolvedValue([]);
    await getInsightReports('org-1', undefined, 10, tenantTx() as never);
    expect(withRls).not.toHaveBeenCalled();
    expect(mockFindMany).toHaveBeenCalledOnce();
  });

  it('reads the latest report of each type in one organization context', async () => {
    mockFindMany.mockImplementation(async () => [{ id: 'latest' }]);
    const latest = await getLatestInsightReports('org-1');
    expect(withRls).toHaveBeenCalledTimes(1);
    expect(withRls).toHaveBeenCalledWith({ organizationId: 'org-1' }, expect.any(Function));
    expect(mockFindMany).toHaveBeenCalledTimes(5);
    expect(latest).toEqual({
      trendForecast: { id: 'latest' },
      employerHotspots: { id: 'latest' },
      stewardCapacity: { id: 'latest' },
      arbitrationEscalation: { id: 'latest' },
      executiveSummary: { id: 'latest' },
    });
    expect(sharedDbUse).not.toHaveBeenCalled();
  });

  it('answers null for a report type the organization has none of', async () => {
    mockFindMany.mockResolvedValue([]);
    const latest = await getLatestInsightReports('org-1');
    expect(Object.values(latest)).toEqual([null, null, null, null, null]);
  });
});
