/**
 * CLC Compliance Reports — Unit Tests
 *
 * Drives every exported report generator (annual compliance, StatCan annual,
 * multi-year trends, org performance, payment patterns, anomaly detection,
 * remittance forecasting) plus their many private helpers (summary, metrics,
 * recommendations, regression/forecast, trend insights, StatCan aggregation).
 *
 * The Drizzle query builder is mocked with a table-aware thenable chain so each
 * `db.select().from(table).where(...)` resolves to seeded rows based on the
 * queried table. Remittances span all 12 months / 4 quarters with on-time,
 * late, critically-late, and overdue scenarios across multiple organizations to
 * exercise the severity/risk/recommendation branches.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({
  remittances: [] as Record<string, unknown>[],
  orgs: [] as Record<string, unknown>[],
  aggregates: [] as Record<string, unknown>[],
}));

vi.mock('drizzle-orm', () => ({
  eq: (...a: unknown[]) => ({ __op: 'eq', a }),
  and: (...a: unknown[]) => ({ __op: 'and', a }),
  inArray: (...a: unknown[]) => ({ __op: 'inArray', a }),
  sql: Object.assign((..._a: unknown[]) => ({ __sql: true }), {}),
}));

vi.mock('@/db/schema', () => ({
  perCapitaRemittances: {
    __name: 'rem',
    remittanceYear: 'remittanceYear',
    remittanceMonth: 'remittanceMonth',
    totalAmount: 'totalAmount',
    fromOrganizationId: 'fromOrganizationId',
  },
  organizations: {
    __name: 'org',
    id: 'id',
    organizationType: 'organizationType',
  },
}));

vi.mock('@/db', () => {
  function makeChain(shape?: unknown) {
    const chain: Record<string, unknown> = { _shape: shape, _table: undefined };
    chain.from = (t: { __name?: string }) => {
      chain._table = t;
      return chain;
    };
    chain.where = () => chain;
    chain.limit = () => chain;
    chain.groupBy = () => chain;
    chain.orderBy = () => chain;
    chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
      let data: unknown;
      if (chain._shape) data = state.aggregates;
      else if ((chain._table as { __name?: string })?.__name === 'org') data = state.orgs;
      else data = state.remittances;
      return Promise.resolve(data).then(resolve, reject);
    };
    return chain;
  }
  return { db: { select: (shape?: unknown) => makeChain(shape) } };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  generateAnnualComplianceReport,
  generateStatCanAnnualReport,
  generateStatCanReport,
  analyzeMultiYearTrends,
  analyzeOrganizationPerformance,
  analyzePaymentPatterns,
  detectComplianceAnomalies,
  detectAnomalies,
  forecastRemittances,
} from '../compliance-reports';

const YEAR = 2024;
const DAY = 24 * 60 * 60 * 1000;

interface RemOpts {
  org: string;
  month: number;
  amount?: number;
  status?: string;
  paidDelayDays?: number | null; // null = not paid
  submittedDelayDays?: number | null; // null = not submitted
  dueOverdue?: boolean;
}

let idCounter = 0;
function rem(o: RemOpts): Record<string, unknown> {
  const monthStr = String(o.month).padStart(2, '0');
  const due = new Date(`${YEAR}-${monthStr}-15T00:00:00Z`);
  const dueDate = o.dueOverdue
    ? new Date(Date.now() - 60 * DAY).toISOString()
    : due.toISOString();
  const baseDue = new Date(dueDate).getTime();
  return {
    id: `rem-${idCounter++}`,
    fromOrganizationId: o.org,
    remittanceYear: YEAR,
    remittanceMonth: `${YEAR}-${monthStr}-10T00:00:00Z`,
    totalAmount: String(o.amount ?? 1000),
    status: o.status ?? 'paid',
    dueDate,
    paidDate:
      o.paidDelayDays === null || o.paidDelayDays === undefined
        ? null
        : new Date(baseDue + o.paidDelayDays * DAY).toISOString(),
    submittedDate:
      o.submittedDelayDays === null || o.submittedDelayDays === undefined
        ? null
        : new Date(baseDue + o.submittedDelayDays * DAY).toISOString(),
    totalMembers: 100,
    goodStandingMembers: 95,
    remittableMembers: 90,
  };
}

function seedRichData() {
  idCounter = 0;
  // org-a: clean, on-time (low risk, perfect compliance)
  // org-b: moderately late (medium risk)
  // org-c: critically late + overdue (high risk)
  state.remittances = [
    // org-a — months 1-4, all on-time paid & submitted on-time
    rem({ org: 'org-a', month: 1, paidDelayDays: -2, submittedDelayDays: -3 }),
    rem({ org: 'org-a', month: 4, paidDelayDays: 0, submittedDelayDays: -1 }),
    rem({ org: 'org-a', month: 7, paidDelayDays: -1, submittedDelayDays: -2 }),
    rem({ org: 'org-a', month: 10, paidDelayDays: 0, submittedDelayDays: 0 }),
    // org-b — late payments / late submissions (medium severity)
    rem({ org: 'org-b', month: 2, paidDelayDays: 20, submittedDelayDays: 10, amount: 2000 }),
    rem({ org: 'org-b', month: 5, paidDelayDays: 40, submittedDelayDays: 16, amount: 2500 }),
    rem({ org: 'org-b', month: 8, paidDelayDays: 12, submittedDelayDays: 5, amount: 1800 }),
    // org-c — critical late payment (>60) & critical late submission (>30) + overdue unpaid
    rem({ org: 'org-c', month: 3, paidDelayDays: 65, submittedDelayDays: 35, amount: 5000 }),
    rem({ org: 'org-c', month: 6, status: 'pending', paidDelayDays: null, submittedDelayDays: 20, dueOverdue: true, amount: 3000 }),
    rem({ org: 'org-c', month: 9, status: 'pending', paidDelayDays: null, submittedDelayDays: null, dueOverdue: true, amount: 4000 }),
    rem({ org: 'org-c', month: 12, paidDelayDays: 45, submittedDelayDays: 16, amount: 6000 }),
  ];
  state.orgs = [
    { id: 'org-a', name: 'Org A', charterNumber: 'A-1', organizationType: 'congress', email: 'a@x.com', phone: '111', address: { city: 'Ottawa' } },
    { id: 'org-b', name: 'Org B', charterNumber: 'B-1', email: 'b@x.com', phone: '222', address: 'somewhere' },
    { id: 'org-c', name: 'Org C', charterNumber: null, email: '', phone: '', address: null },
  ];
  // Aggregate rows for forecastRemittances (≥6 rows → 85% confidence, moving_average)
  state.aggregates = Array.from({ length: 8 }, (_, i) => ({
    month: (i % 12) + 1,
    year: YEAR,
    totalAmount: 10000 + i * 500,
    remittanceCount: 10 + i,
  }));
}

describe('clc compliance-reports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedRichData();
  });

  it('generateAnnualComplianceReport assembles all sections', async () => {
    const report = await generateAnnualComplianceReport(YEAR);
    expect(report.year).toBe(YEAR);
    expect(report.summary.totalRemittances).toBe(state.remittances.length);
    expect(report.summary.totalOrganizations).toBe(3);
    expect(report.organizationPerformance.length).toBe(3);
    expect(Array.isArray(report.paymentPatterns.monthlyDistribution)).toBe(true);
    expect(report.paymentPatterns.monthlyDistribution.length).toBe(12);
    expect(report.paymentPatterns.seasonalTrends.length).toBe(4);
    expect(report.complianceMetrics).toHaveProperty('onTimePaymentRate');
    expect(report.anomalies.length).toBeGreaterThan(0);
    expect(report.recommendations.length).toBeGreaterThan(0);
  });

  it('anomalies include critical late_payment and late_submission, sorted by severity', async () => {
    const anomalies = await detectComplianceAnomalies(state.remittances as never, YEAR);
    expect(anomalies.some((a) => a.type === 'late_payment')).toBe(true);
    expect(anomalies.some((a) => a.type === 'late_submission')).toBe(true);
    expect(anomalies.some((a) => a.severity === 'critical')).toBe(true);
    // sorted: critical first
    const sevRank = { critical: 0, high: 1, medium: 2, low: 3 } as const;
    for (let i = 1; i < anomalies.length; i++) {
      expect(sevRank[anomalies[i].severity]).toBeGreaterThanOrEqual(sevRank[anomalies[i - 1].severity]);
    }
    // detectAnomalies alias resolves to same impl
    expect(typeof detectAnomalies).toBe('function');
  });

  it('analyzeOrganizationPerformance computes per-org metrics, risk levels, sorted by amount', async () => {
    const perf = await analyzeOrganizationPerformance(state.remittances as never, YEAR);
    expect(perf.length).toBe(3);
    // sorted descending by totalAmount
    for (let i = 1; i < perf.length; i++) {
      expect(perf[i].totalAmount).toBeLessThanOrEqual(perf[i - 1].totalAmount);
    }
    const riskLevels = perf.map((p) => p.riskLevel);
    expect(riskLevels).toContain('high');
    expect(riskLevels).toContain('low');
  });

  it('analyzePaymentPatterns returns monthly, seasonal, and rate breakdowns', async () => {
    const patterns = await analyzePaymentPatterns(state.remittances as never, YEAR);
    expect(patterns.monthlyDistribution.length).toBe(12);
    expect(patterns.seasonalTrends.length).toBe(4);
    expect(patterns.onTimePaymentRate).toBeGreaterThanOrEqual(0);
    expect(patterns.latePaymentRate).toBeGreaterThan(0);
    expect(patterns.nonPaymentRate).toBeGreaterThan(0);
  });

  it('generateStatCanAnnualReport aggregates financial + membership data', async () => {
    const report = await generateStatCanAnnualReport(YEAR);
    expect(report.fiscalYear).toBe(YEAR);
    expect(report.organizationInfo.name).toBe('Org A');
    expect(report.financialSummary.category020_perCapitaRevenue).toBeGreaterThan(0);
    expect(report.financialSummary.totalRevenue).toBe(report.financialSummary.category020_perCapitaRevenue);
    expect(report.membershipData.totalMembers).toBeGreaterThan(0);
    expect(report.complianceNotes).toContain(String(YEAR));
    // generateStatCanReport is an alias
    expect(generateStatCanReport).toBe(generateStatCanAnnualReport);
  });

  it('generateStatCanAnnualReport tolerates empty congress org (fallback defaults)', async () => {
    state.orgs = []; // no congress org found
    const report = await generateStatCanAnnualReport(YEAR);
    expect(report.organizationInfo.name).toBe('Canadian Labour Congress');
    expect(report.organizationInfo.charterNumber).toBe('CLC-001');
  });

  it('analyzeMultiYearTrends computes trends, forecast, and insights', async () => {
    const trends = await analyzeMultiYearTrends({ years: 5, endYear: YEAR });
    expect(trends.years.length).toBe(5);
    expect(trends.totalRemittancesTrend.length).toBe(5);
    expect(trends.totalAmountTrend.length).toBe(5);
    expect(trends.complianceRateTrend.length).toBe(5);
    expect(trends.organizationGrowth.length).toBe(5);
    expect(trends.forecastNextYear.year).toBe(YEAR + 1);
    expect(trends.forecastNextYear.confidenceLevel).toBeGreaterThan(0);
    expect(trends.keyInsights.length).toBeGreaterThan(0);
  });

  it('analyzeMultiYearTrends with default endYear and single year (insufficient data path)', async () => {
    state.remittances = [rem({ org: 'org-a', month: 1, paidDelayDays: 0, submittedDelayDays: 0 })];
    const trends = await analyzeMultiYearTrends({ years: 1 });
    expect(trends.years.length).toBe(1);
    // forecast falls back to latest values; insights mention insufficient data
    expect(trends.forecastNextYear.confidenceLevel).toBe(0);
    expect(trends.keyInsights.some((i) => i.includes('Insufficient'))).toBe(true);
  });

  it('forecastRemittances produces moving-average forecasts with confidence bounds', async () => {
    const forecast = await forecastRemittances(3);
    expect(forecast.length).toBe(3);
    expect(forecast[0].method).toBe('moving_average');
    expect(forecast[0].confidenceLevel).toBe(85);
    expect(forecast[0]).toHaveProperty('lowerBound');
    expect(forecast[0]).toHaveProperty('upperBound');
  });

  it('forecastRemittances handles sparse history (insufficient_data method)', async () => {
    state.aggregates = [{ month: 1, year: YEAR, totalAmount: 5000, remittanceCount: 5 }];
    const forecast = await forecastRemittances(2);
    expect(forecast.length).toBe(2);
    expect(forecast[0].method).toBe('insufficient_data');
    expect(forecast[0].confidenceLevel).toBe(50);
  });

  it('forecastRemittances handles empty history', async () => {
    state.aggregates = [];
    const forecast = await forecastRemittances(1);
    expect(forecast.length).toBe(1);
    expect(forecast[0].forecastAmount).toBe(0);
  });

  it('generates URGENT recommendations for low compliance and high delays', async () => {
    // All overdue/unpaid → very low compliance, large outstanding & delays
    state.remittances = [
      rem({ org: 'org-c', month: 1, status: 'pending', paidDelayDays: null, submittedDelayDays: 40, dueOverdue: true, amount: 9000 }),
      rem({ org: 'org-c', month: 2, paidDelayDays: 80, submittedDelayDays: 40, amount: 9000 }),
    ];
    const report = await generateAnnualComplianceReport(YEAR);
    expect(report.recommendations.some((r) => r.includes('URGENT') || r.includes('Outstanding'))).toBe(true);
  });
});
