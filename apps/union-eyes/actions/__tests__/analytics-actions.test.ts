import { beforeEach, describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const helpers = {
    eq: () => ({}),
    and: () => ({}),
    or: () => ({}),
    gte: () => ({}),
    lte: () => ({}),
    isNotNull: () => ({}),
    desc: () => ({}),
  };
  const stub = new Proxy({}, { get: () => ({}) });
  const m = {
    auth: vi.fn(),
    claimsFindMany: vi.fn(() => [] as unknown[]),
    membersFindMany: vi.fn(() => [] as unknown[]),
    membersFindFirst: vi.fn(() => undefined as unknown),
    metricsFindMany: vi.fn(() => [] as unknown[]),
    metricsFindFirst: vi.fn(() => undefined as unknown),
    insertReturning: vi.fn(() => [{ id: 'row-1' }] as unknown[]),
    forecastLinearRegression: vi.fn(),
    generateEnsembleForecast: vi.fn(),
    detectTrend: vi.fn(),
    revalidatePath: vi.fn(),
    loggerError: vi.fn(),
    getOrganizationIdForUser: vi.fn(),
  };
  const q = (resultFn: () => unknown) => (opts: { where?: unknown; orderBy?: unknown }) => {
    if (opts && typeof opts.where === 'function') (opts.where as (...a: unknown[]) => unknown)(stub, helpers);
    if (opts && typeof opts.orderBy === 'function') (opts.orderBy as (...a: unknown[]) => unknown)(stub, helpers);
    return resultFn();
  };
  const fakeDb = {
    query: {
      claims: { findMany: q(() => m.claimsFindMany()), findFirst: q(() => m.claimsFindMany()) },
      organizationMembers: { findMany: q(() => m.membersFindMany()), findFirst: q(() => m.membersFindFirst()) },
      analyticsMetrics: { findMany: q(() => m.metricsFindMany()), findFirst: q(() => m.metricsFindFirst()) },
    },
    insert: () => ({ values: () => ({ returning: () => m.insertReturning() }) }),
  };
  return { ...m, fakeDb };
});

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: (_ctx: unknown, cb: (db: unknown) => unknown) => cb(mocks.fakeDb),
}));
vi.mock('@/db/schema', () => ({
  analyticsMetrics: {},
  kpiConfigurations: {},
  mlPredictions: {},
  trendAnalyses: {},
}));
vi.mock('@/lib/ml/predictive-analytics', () => ({
  forecastLinearRegression: mocks.forecastLinearRegression,
  generateEnsembleForecast: mocks.generateEnsembleForecast,
  detectTrend: mocks.detectTrend,
}));
vi.mock('drizzle-orm', () => ({
  eq: () => ({}),
  and: () => ({}),
  gte: () => ({}),
  lte: () => ({}),
  desc: () => ({}),
}));
vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: mocks.auth }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/lib/logger', () => ({ logger: { error: mocks.loggerError } }));
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: mocks.getOrganizationIdForUser }));

import {
  calculateMetrics,
  generatePredictions,
  detectMetricTrends,
  createKPI,
  getAnalyticsMetrics,
} from '../analytics-actions';

const baseMetric = (value: number) => ({
  periodStart: new Date('2024-01-01T00:00:00Z'),
  metricValue: String(value),
  metadata: {},
});

describe('analytics-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ userId: 'user-1', orgId: 'org-1' });
    mocks.getOrganizationIdForUser.mockResolvedValue('org-1');
    mocks.claimsFindMany.mockReturnValue([]);
    mocks.membersFindMany.mockReturnValue([]);
    mocks.membersFindFirst.mockReturnValue(undefined);
    mocks.metricsFindMany.mockReturnValue([]);
    mocks.metricsFindFirst.mockReturnValue(undefined);
    mocks.insertReturning.mockReturnValue([{ id: 'row-1' }]);
  });

  describe('calculateMetrics', () => {
    const params = {
      metricType: 'claims_volume',
      metricName: 'Claims Volume',
      periodType: 'monthly' as const,
      periodStart: new Date('2024-02-01T00:00:00Z'),
      periodEnd: new Date('2024-02-28T00:00:00Z'),
    };

    it('calculates claims_volume metrics', async () => {
      mocks.claimsFindMany.mockReturnValue([{ claimId: 'c1', createdAt: new Date() }]);
      const result = await calculateMetrics(params);
      expect(result).toMatchObject({ success: true });
    });

    it('detects an upward trend versus the previous period', async () => {
      mocks.claimsFindMany.mockReturnValue(Array.from({ length: 20 }, (_, i) => ({ claimId: `c${i}`, createdAt: new Date() })));
      mocks.metricsFindFirst.mockReturnValue({ metricValue: '10' });
      const result = await calculateMetrics(params);
      expect(result.success).toBe(true);
    });

    it('detects a downward trend versus the previous period', async () => {
      mocks.claimsFindMany.mockReturnValue([{ claimId: 'c1', createdAt: new Date() }]);
      mocks.metricsFindFirst.mockReturnValue({ metricValue: '100' });
      const result = await calculateMetrics(params);
      expect(result.success).toBe(true);
    });

    it('handles resolution_time with no resolved claims', async () => {
      mocks.claimsFindMany.mockReturnValue([]);
      const result = await calculateMetrics({ ...params, metricType: 'resolution_time' });
      expect(result.success).toBe(true);
    });

    it('handles resolution_time with resolved claims (incl null createdAt)', async () => {
      mocks.claimsFindMany.mockReturnValue([
        { resolvedAt: new Date('2024-02-10T00:00:00Z'), createdAt: new Date('2024-02-01T00:00:00Z') },
        { resolvedAt: new Date('2024-02-10T00:00:00Z'), createdAt: null },
      ]);
      const result = await calculateMetrics({ ...params, metricType: 'resolution_time' });
      expect(result.success).toBe(true);
    });

    it('handles member_growth metrics', async () => {
      mocks.membersFindMany.mockReturnValue([{ id: 'm1' }]);
      const result = await calculateMetrics({ ...params, metricType: 'member_growth' });
      expect(result.success).toBe(true);
    });

    it('returns an error for an unsupported metric type', async () => {
      const result = await calculateMetrics({ ...params, metricType: 'nope' });
      expect(result).toMatchObject({ success: false });
    });

    it('resolves the org id via getOrganizationIdForUser when no active org is present on the session', async () => {
      mocks.auth.mockResolvedValue({ userId: 'user-1', orgId: undefined });
      mocks.getOrganizationIdForUser.mockResolvedValueOnce('org-resolved');
      mocks.claimsFindMany.mockReturnValue([{ claimId: 'c1', createdAt: new Date() }]);
      const result = await calculateMetrics(params);
      expect(result.success).toBe(true);
    });

    it('returns an error when unauthenticated', async () => {
      mocks.auth.mockResolvedValue({ userId: null, orgId: null });
      const result = await calculateMetrics(params);
      expect(result.success).toBe(false);
    });

    it('returns an error when the org id cannot be resolved', async () => {
      mocks.auth.mockResolvedValue({ userId: 'user-1', orgId: undefined });
      mocks.getOrganizationIdForUser.mockRejectedValueOnce(new Error('no verified organization'));
      const result = await calculateMetrics(params);
      expect(result.success).toBe(false);
    });
  });

  describe('generatePredictions', () => {
    const sevenMetrics = Array.from({ length: 7 }, (_, i) => baseMetric(i + 1));
    const prediction = {
      predictedValue: 5,
      confidenceInterval: { lower: 4, upper: 6 },
      confidenceScore: 0.9,
    };

    it('returns an error with insufficient history', async () => {
      mocks.metricsFindMany.mockReturnValue([baseMetric(1), baseMetric(2)]);
      const result = await generatePredictions({ predictionType: 'claims_volume', periodsAhead: 3 });
      expect(result.success).toBe(false);
    });

    it('generates an ensemble forecast', async () => {
      mocks.metricsFindMany.mockReturnValue(sevenMetrics);
      mocks.generateEnsembleForecast.mockReturnValue([prediction]);
      const result = await generatePredictions({ predictionType: 'claims_volume', periodsAhead: 1 });
      expect(result.success).toBe(true);
      expect(mocks.generateEnsembleForecast).toHaveBeenCalled();
    });

    it('generates a linear regression forecast', async () => {
      mocks.metricsFindMany.mockReturnValue(sevenMetrics);
      mocks.forecastLinearRegression.mockReturnValue([prediction]);
      const result = await generatePredictions({ predictionType: 'budget_forecast', periodsAhead: 1, modelName: 'linear_regression' });
      expect(result.success).toBe(true);
      expect(mocks.forecastLinearRegression).toHaveBeenCalled();
    });

    it('returns an error for an unsupported model', async () => {
      mocks.metricsFindMany.mockReturnValue(sevenMetrics);
      const result = await generatePredictions({ predictionType: 'claims_volume', periodsAhead: 1, modelName: 'moving_average' });
      expect(result).toMatchObject({ success: false, error: 'Unsupported model' });
    });

    it('returns an error when unauthenticated', async () => {
      mocks.auth.mockResolvedValue({ userId: null });
      const result = await generatePredictions({ predictionType: 'claims_volume', periodsAhead: 1 });
      expect(result.success).toBe(false);
    });
  });

  describe('detectMetricTrends', () => {
    const sevenMetrics = Array.from({ length: 7 }, (_, i) => baseMetric(i + 1));

    it('returns an error with insufficient data', async () => {
      mocks.metricsFindMany.mockReturnValue([baseMetric(1)]);
      const result = await detectMetricTrends({ metricType: 'claims_volume' });
      expect(result.success).toBe(false);
    });

    it('detects trends and generates insights/recommendations', async () => {
      mocks.metricsFindMany.mockReturnValue(sevenMetrics);
      mocks.detectTrend.mockReturnValue({
        detectedTrend: 'increasing',
        trendStrength: 0.8,
        anomalies: Array.from({ length: 6 }, () => ({ severity: 'critical' })),
        seasonalPattern: { period: 7, strength: 0.7 },
        correlations: [],
        confidence: 0.9,
      });
      const result = await detectMetricTrends({ metricType: 'claims_volume', daysBack: 60 });
      expect(result.success).toBe(true);
    });

    it('handles a stable trend with no anomalies or seasonality', async () => {
      mocks.metricsFindMany.mockReturnValue(sevenMetrics);
      mocks.detectTrend.mockReturnValue({
        detectedTrend: 'stable',
        trendStrength: 0.2,
        anomalies: [],
        seasonalPattern: null,
        correlations: [],
        confidence: 0.5,
      });
      const result = await detectMetricTrends({ metricType: 'claims_volume' });
      expect(result.success).toBe(true);
    });

    it('returns an error when unauthenticated', async () => {
      mocks.auth.mockResolvedValue({ userId: null });
      const result = await detectMetricTrends({ metricType: 'claims_volume' });
      expect(result.success).toBe(false);
    });
  });

  describe('createKPI', () => {
    const params = {
      name: 'My KPI',
      metricType: 'custom',
      dataSource: 'claims',
      calculation: {},
      visualizationType: 'line' as const,
    };

    it('creates a KPI with optional fields', async () => {
      const result = await createKPI({
        ...params,
        description: 'desc',
        targetValue: 10,
        warningThreshold: 5,
        criticalThreshold: 2,
        alertEnabled: true,
        alertRecipients: ['a@x.com'],
      });
      expect(result.success).toBe(true);
    });

    it('creates a KPI with defaults applied', async () => {
      const result = await createKPI(params);
      expect(result.success).toBe(true);
    });

    it('returns an error when unauthenticated', async () => {
      mocks.auth.mockResolvedValue({ userId: null });
      const result = await createKPI(params);
      expect(result.success).toBe(false);
    });
  });

  describe('getAnalyticsMetrics', () => {
    it('returns metrics applying all filters', async () => {
      mocks.metricsFindMany.mockReturnValue([baseMetric(1)]);
      const result = await getAnalyticsMetrics({
        metricType: 'claims_volume',
        periodType: 'monthly',
        startDate: new Date('2024-01-01T00:00:00Z'),
        endDate: new Date('2024-02-01T00:00:00Z'),
        limit: 10,
      });
      expect(result.success).toBe(true);
    });

    it('returns metrics with no filters', async () => {
      const result = await getAnalyticsMetrics({});
      expect(result.success).toBe(true);
    });

    it('returns an error when unauthenticated', async () => {
      mocks.auth.mockResolvedValue({ userId: null, orgId: undefined });
      mocks.membersFindFirst.mockReturnValue(undefined);
      const result = await getAnalyticsMetrics({});
      expect(result.success).toBe(false);
    });
  });
});
