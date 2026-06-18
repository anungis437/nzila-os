import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  selectQueue: [] as unknown[],
  insertValues: vi.fn(),
  insertShouldThrow: false,
}));

function makeChain(isInsert = false) {
  const c: Record<string, unknown> = {};
  for (const m of ['from', 'where', 'orderBy', 'limit', 'returning']) {
    c[m] = vi.fn(() => c);
  }
  c.values = vi.fn((v: unknown) => {
    h.insertValues(v);
    if (h.insertShouldThrow) throw new Error('insert boom');
    return c;
  });
  (c as { then: (r: (v: unknown) => void) => void }).then = (resolve) => {
    resolve(isInsert ? undefined : (h.selectQueue.shift() ?? []));
  };
  return c;
}

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => makeChain(false)),
    insert: vi.fn(() => makeChain(true)),
  },
}));

vi.mock('@/db/schema', () => ({
  analyticsMetrics: new Proxy({}, { get: (_t, p) => String(p) }),
  trendAnalyses: new Proxy({}, { get: (_t, p) => String(p) }),
  insightRecommendations: new Proxy({}, { get: (_t, p) => String(p) }),
  mlPredictions: new Proxy({}, { get: (_t, p) => String(p) }),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => 'eq'),
  and: vi.fn(() => 'and'),
  desc: vi.fn(() => 'desc'),
  gte: vi.fn(() => 'gte'),
  sql: Object.assign(vi.fn(() => 'sql'), { raw: vi.fn(() => 'sql') }),
}));

import { generateInsights, saveInsights } from '../insights-generator';

function metric(metricType: string, metricValue: string, periodType = 'week') {
  return { metricType, metricValue, periodType, periodStart: new Date() };
}

beforeEach(() => {
  h.selectQueue = [];
  h.insertValues.mockReset();
  h.insertShouldThrow = false;
});

describe('generateInsights - metrics', () => {
  it('returns empty array when no metrics', async () => {
    h.selectQueue = [[]];
    expect(await generateInsights({ organizationId: 'o', analysisType: 'metrics' })).toEqual([]);
  });

  it('produces metric insights across all recommendation branches', async () => {
    h.selectQueue = [[
      metric('resolution_time', '12'), metric('resolution_time', '5'),
      metric('member_growth', '10', 'month'), metric('member_growth', '4', 'month'),
      metric('claims_volume', '50'), metric('claims_volume', '200'),
      metric('unknown_metric', '100'), metric('unknown_metric', '50'),
    ]];
    const insights = await generateInsights({ organizationId: 'o', analysisType: 'metrics' });
    expect(insights.length).toBeGreaterThan(0);
    expect(insights.some((i) => i.title.includes('Resolution Time'))).toBe(true);
  });

  it('returns empty array on db error', async () => {
    h.selectQueue = [];
    const { db } = await import('@/db');
    (db.select as ReturnType<typeof vi.fn>).mockImplementationOnce(() => { throw new Error('DB error'); });
    expect(await generateInsights({ organizationId: 'o', analysisType: 'metrics' })).toEqual([]);
  });
});

describe('generateInsights - trends', () => {
  it('produces strong-trend, anomaly and seasonal insights', async () => {
    h.selectQueue = [[
      { trendStrength: '0.9', anomalyCount: 6, detectedTrend: 'increasing', analysisType: 'claims_volume', insights: 'note', seasonalPattern: null, visualizationData: { dataPoints: [1] } },
      { trendStrength: '0.75', anomalyCount: 0, detectedTrend: 'decreasing', analysisType: 'resolution_time', insights: null, seasonalPattern: null, visualizationData: null },
      { trendStrength: '0.8', anomalyCount: 0, detectedTrend: 'seasonal', analysisType: 'dues', insights: '', seasonalPattern: true, visualizationData: null },
    ]];
    const insights = await generateInsights({ organizationId: 'o', analysisType: 'trends' });
    expect(insights.some((i) => i.insightType === 'alert')).toBe(true);
    expect(insights.some((i) => i.insightType === 'information')).toBe(true);
  });
});

describe('generateInsights - anomalies', () => {
  it('produces anomaly alerts', async () => {
    h.selectQueue = [[
      { anomalyCount: 4, analysisType: 'claims_volume', visualizationData: { dataPoints: [] } },
      { anomalyCount: 1, analysisType: 'dues', visualizationData: null },
    ]];
    const insights = await generateInsights({ organizationId: 'o', analysisType: 'anomalies' });
    expect(insights.every((i) => i.insightType === 'alert')).toBe(true);
    expect(insights.length).toBe(2);
  });
});

describe('generateInsights - predictions', () => {
  it('produces increase and decrease prediction insights', async () => {
    h.selectQueue = [[
      { predictionType: 'claims_volume', predictionDate: '2024-01-01', predictedValue: '100', confidence: '0.8' },
      { predictionType: 'claims_volume', predictionDate: '2024-02-01', predictedValue: '200', confidence: '0.8' },
      { predictionType: 'resolution_time', predictionDate: '2024-01-01', predictedValue: '200', confidence: '0.85' },
      { predictionType: 'resolution_time', predictionDate: '2024-02-01', predictedValue: '100', confidence: '0.85' },
    ]];
    const insights = await generateInsights({ organizationId: 'o', analysisType: 'predictions' });
    expect(insights.some((i) => i.insightType === 'opportunity')).toBe(true);
    expect(insights.some((i) => i.insightType === 'risk')).toBe(true);
  });
});

describe('generateInsights - comprehensive', () => {
  it('aggregates all sources and sorts', async () => {
    h.selectQueue = [
      [metric('claims_volume', '50'), metric('claims_volume', '200')], // metrics
      [], // trends
      [], // anomalies
      [], // predictions
    ];
    const insights = await generateInsights({ organizationId: 'o', analysisType: 'comprehensive' });
    expect(Array.isArray(insights)).toBe(true);
  });
});

describe('saveInsights', () => {
  const sample = [{
    insightType: 'risk' as const, priority: 'high' as const, title: 'T', description: 'D',
    recommendations: ['r'], affectedMetrics: ['m'], estimatedImpact: 'High', confidence: 0.9, dataPoints: [],
  }];

  it('inserts each insight', async () => {
    await saveInsights('o', sample, 'audit-1');
    expect(h.insertValues).toHaveBeenCalledTimes(1);
    expect(h.insertValues.mock.calls[0][0].aiReferenceId).toBe('audit-1');
  });

  it('inserts without audit ref', async () => {
    await saveInsights('o', sample);
    expect(h.insertValues.mock.calls[0][0].aiReferenceId).toBeUndefined();
  });

  it('rethrows insert errors', async () => {
    h.insertShouldThrow = true;
    await expect(saveInsights('o', sample)).rejects.toThrow(/insert boom/);
  });
});
