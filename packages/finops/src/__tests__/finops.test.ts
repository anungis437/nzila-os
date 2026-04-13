/**
 * @nzila/finops — Test Suite
 */

import { describe, it, expect } from 'vitest';
import {
  enforceQuota,
  getQuotaUsage,
  DEFAULT_QUOTA_POLICIES,
  type QuotaPolicy,
} from '../quotas.js';
import {
  generateRecommendations,
  estimateSavings,
  type UsageSnapshot,
} from '../recommendations.js';
import {
  createUsageMeter,
  aggregateUsage,
} from '../metering.js';
import {
  evaluateBudgetAlerts,
  DEFAULT_ALERT_THRESHOLDS,
  type OrgBudget,
  type BudgetThreshold,
} from '../alerts.js';

// ── Quotas ────────────────────────────────────────────────────────────────────

describe('Quota Enforcement', () => {
  const policy: QuotaPolicy = {
    orgId: 'org_test',
    resource: 'ai_requests',
    limit: 1000,
    period: 'daily',
    enforcement: 'hard',
    warningThreshold: 80,
  };

  it('allows request within quota', () => {
    const result = enforceQuota(policy, 500);
    expect(result.allowed).toBe(true);
    expect(result.usage.status).toBe('ok');
  });

  it('warns when approaching quota threshold', () => {
    const result = enforceQuota(policy, 850);
    expect(result.allowed).toBe(true);
    expect(result.usage.status).toBe('warning');
    expect(result.recommendation).toBeDefined();
  });

  it('blocks hard quota exceedance', () => {
    const result = enforceQuota(policy, 1001);
    expect(result.allowed).toBe(false);
    expect(result.usage.status).toBe('exceeded');
    expect(result.reason).toContain('Hard limit');
  });

  it('allows soft quota exceedance with warning', () => {
    const softPolicy = { ...policy, enforcement: 'soft' as const };
    const result = enforceQuota(softPolicy, 1001);
    expect(result.allowed).toBe(true);
    expect(result.usage.status).toBe('exceeded');
    expect(result.reason).toContain('Soft limit');
  });

  it('returns usage summary for org', () => {
    const policies: QuotaPolicy[] = [
      { ...policy, orgId: 'org_1' },
      { ...policy, orgId: 'org_1', resource: 'storage_gb', limit: 50, enforcement: 'soft' },
    ];
    const usageData = new Map([['ai_requests', 800], ['storage_gb', 10]]);

    const usage = getQuotaUsage('org_1', policies, usageData);
    expect(usage).toHaveLength(2);
    expect(usage[0]!.resource).toBe('ai_requests');
    expect(usage[0]!.status).toBe('warning');
    expect(usage[1]!.resource).toBe('storage_gb');
    expect(usage[1]!.status).toBe('ok');
  });

  it('returns exceeded status when usage meets or exceeds limit', () => {
    const policies: QuotaPolicy[] = [
      { ...policy, orgId: 'org_1' },
    ];
    const usageData = new Map([['ai_requests', 1000]]);

    const usage = getQuotaUsage('org_1', policies, usageData);
    expect(usage[0]!.status).toBe('exceeded');
    expect(usage[0]!.utilizationPercent).toBe(100);
  });

  it('defaults to zero when resource has no usage data', () => {
    const policies: QuotaPolicy[] = [
      { ...policy, orgId: 'org_1', resource: 'egress_gb', limit: 100, enforcement: 'soft' },
    ];
    const usageData = new Map<string, number>();

    const usage = getQuotaUsage('org_1', policies, usageData);
    expect(usage[0]!.current).toBe(0);
    expect(usage[0]!.status).toBe('ok');
  });

  it('has sensible default policies', () => {
    expect(DEFAULT_QUOTA_POLICIES.length).toBeGreaterThan(5);
    for (const p of DEFAULT_QUOTA_POLICIES) {
      expect(p.limit).toBeGreaterThan(0);
      expect(p.warningThreshold).toBeGreaterThan(0);
      expect(p.warningThreshold).toBeLessThanOrEqual(100);
    }
  });
});

// ── Recommendations ───────────────────────────────────────────────────────────

describe('FinOps Recommendations', () => {
  it('skips AI recommendation when tokens per request are within threshold', () => {
    const snapshots: UsageSnapshot[] = [
      {
        orgId: 'org_1',
        period: '2025-01',
        aiRequests: 1000,
        aiTokensUsed: 500_000,
        storageGb: 1,
        computeHours: 50,
        egressGb: 1,
        dbConnectionPeak: 5,
        integrationCalls: 10,
        avgResponseTimeMs: 200,
      },
    ];

    const recs = generateRecommendations(snapshots);
    const aiRec = recs.find((r) => r.category === 'ai-optimization');
    expect(aiRec).toBeUndefined();
  });

  it('generates AI optimization recommendation for verbose prompts', () => {
    const snapshots: UsageSnapshot[] = [
      {
        orgId: 'org_1',
        period: '2025-01',
        aiRequests: 1000,
        aiTokensUsed: 3_000_000,
        storageGb: 10,
        computeHours: 50,
        egressGb: 5,
        dbConnectionPeak: 10,
        integrationCalls: 100,
        avgResponseTimeMs: 200,
      },
    ];

    const recs = generateRecommendations(snapshots);
    const aiRec = recs.find((r) => r.category === 'ai-optimization');
    expect(aiRec).toBeDefined();
    expect(aiRec!.estimatedMonthlySavings).toBeGreaterThan(0);
  });

  it('generates storage lifecycle recommendation for high storage', () => {
    const snapshots: UsageSnapshot[] = [
      {
        orgId: 'org_1',
        period: '2025-01',
        aiRequests: 0,
        aiTokensUsed: 0,
        storageGb: 200,
        computeHours: 50,
        egressGb: 5,
        dbConnectionPeak: 10,
        integrationCalls: 100,
        avgResponseTimeMs: 200,
      },
    ];

    const recs = generateRecommendations(snapshots);
    const storageRec = recs.find((r) => r.category === 'data-lifecycle');
    expect(storageRec).toBeDefined();
    expect(storageRec!.priority).toBe('medium');
  });

  it('estimates total savings from recommendations', () => {
    const snapshots: UsageSnapshot[] = [
      {
        orgId: 'org_1',
        period: '2025-01',
        aiRequests: 5000,
        aiTokensUsed: 15_000_000,
        storageGb: 300,
        computeHours: 5,
        egressGb: 100,
        dbConnectionPeak: 50,
        integrationCalls: 100,
        avgResponseTimeMs: 200,
      },
    ];

    const recs = generateRecommendations(snapshots);
    const savings = estimateSavings(recs);
    expect(savings.totalMonthlySavings).toBeGreaterThan(0);
    expect(savings.totalAnnualSavings).toBeCloseTo(savings.totalMonthlySavings * 12, 0);
  });
});

// ── Metering ──────────────────────────────────────────────────────────────────

describe('Usage Metering', () => {
  it('records and retrieves usage events', () => {
    const meter = createUsageMeter();
    meter.record({
      orgId: 'org_1',
      resource: 'ai_requests',
      quantity: 10,
      unit: 'requests',
      timestamp: '2025-01-15T10:00:00Z',
    });
    meter.record({
      orgId: 'org_1',
      resource: 'ai_requests',
      quantity: 20,
      unit: 'requests',
      timestamp: '2025-01-15T11:00:00Z',
    });

    const records = meter.getRecords('org_1', 'ai_requests');
    expect(records).toHaveLength(2);
  });

  it('filters by org', () => {
    const meter = createUsageMeter();
    meter.record({
      orgId: 'org_1',
      resource: 'storage_gb',
      quantity: 5,
      unit: 'GB',
      timestamp: '2025-01-15T10:00:00Z',
    });
    meter.record({
      orgId: 'org_2',
      resource: 'storage_gb',
      quantity: 10,
      unit: 'GB',
      timestamp: '2025-01-15T10:00:00Z',
    });

    expect(meter.getRecords('org_1')).toHaveLength(1);
    expect(meter.getRecords('org_2')).toHaveLength(1);
  });

  it('flushes and clears buffer', () => {
    const meter = createUsageMeter();
    meter.record({
      orgId: 'org_1',
      resource: 'api_calls',
      quantity: 100,
      unit: 'calls',
      timestamp: '2025-01-15T10:00:00Z',
    });

    const flushed = meter.flush();
    expect(flushed).toHaveLength(1);
    expect(meter.getRecords('org_1')).toHaveLength(0);
  });

  it('aggregates usage by org and resource', () => {
    const records = [
      { orgId: 'org_1', resource: 'ai_requests', quantity: 100, unit: 'requests', timestamp: '2025-01-15T10:00:00Z' },
      { orgId: 'org_1', resource: 'ai_requests', quantity: 200, unit: 'requests', timestamp: '2025-01-15T11:00:00Z' },
      { orgId: 'org_1', resource: 'storage_gb', quantity: 5, unit: 'GB', timestamp: '2025-01-15T10:00:00Z' },
      { orgId: 'org_2', resource: 'ai_requests', quantity: 50, unit: 'requests', timestamp: '2025-01-15T10:00:00Z' },
    ];

    const aggregated = aggregateUsage(records, '2025-01-15T00:00:00Z', '2025-01-15T23:59:59Z');
    expect(aggregated).toHaveLength(3);

    const org1Ai = aggregated.find((a) => a.orgId === 'org_1' && a.resource === 'ai_requests');
    expect(org1Ai!.totalQuantity).toBe(300);
    expect(org1Ai!.peakQuantity).toBe(200);
    expect(org1Ai!.recordCount).toBe(2);
  });
});

// ── Budget Alerts ─────────────────────────────────────────────────────────────

describe('Budget Alerts', () => {
  it('generates no alerts for low spend', () => {
    const budgets: OrgBudget[] = [
      { orgId: 'org_1', resource: 'ai_requests', limit: 500, period: 'daily', currentSpend: 100 },
    ];

    const alerts = evaluateBudgetAlerts(budgets);
    expect(alerts).toHaveLength(0);
  });

  it('generates info alert at 50%', () => {
    const budgets: OrgBudget[] = [
      { orgId: 'org_1', resource: 'ai_requests', limit: 100, period: 'daily', currentSpend: 55 },
    ];

    const alerts = evaluateBudgetAlerts(budgets);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.severity).toBe('info');
  });

  it('generates warning alert at 80%', () => {
    const budgets: OrgBudget[] = [
      { orgId: 'org_1', resource: 'ai_requests', limit: 100, period: 'daily', currentSpend: 82 },
    ];

    const alerts = evaluateBudgetAlerts(budgets);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.severity).toBe('warning');
  });

  it('generates critical alert at 95%+', () => {
    const budgets: OrgBudget[] = [
      { orgId: 'org_1', resource: 'ai_requests', limit: 100, period: 'daily', currentSpend: 96 },
    ];

    const alerts = evaluateBudgetAlerts(budgets);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.severity).toBe('critical');
  });

  it('generates throttle action at 100%+', () => {
    const budgets: OrgBudget[] = [
      { orgId: 'org_1', resource: 'ai_requests', limit: 100, period: 'daily', currentSpend: 105 },
    ];

    const alerts = evaluateBudgetAlerts(budgets);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.severity).toBe('critical');
    expect(alerts[0]!.message).toContain('throttled');
  });

  it('sorts alerts by severity then utilization', () => {
    const budgets: OrgBudget[] = [
      { orgId: 'org_1', resource: 'ai_requests', limit: 100, period: 'daily', currentSpend: 55 },
      { orgId: 'org_2', resource: 'storage_gb', limit: 100, period: 'monthly', currentSpend: 98 },
      { orgId: 'org_3', resource: 'compute', limit: 100, period: 'daily', currentSpend: 85 },
    ];

    const alerts = evaluateBudgetAlerts(budgets);
    expect(alerts[0]!.severity).toBe('critical');
    expect(alerts[1]!.severity).toBe('warning');
    expect(alerts[2]!.severity).toBe('info');
  });

  it('sorts by utilization when severity is the same', () => {
    const budgets: OrgBudget[] = [
      { orgId: 'org_a', resource: 'storage', limit: 100, period: 'daily', currentSpend: 60 },
      { orgId: 'org_b', resource: 'compute', limit: 100, period: 'daily', currentSpend: 70 },
    ];

    const alerts = evaluateBudgetAlerts(budgets);
    expect(alerts).toHaveLength(2);
    // Both are 'info' severity — higher utilization first
    expect(alerts[0]!.orgId).toBe('org_b');
    expect(alerts[1]!.orgId).toBe('org_a');
  });

  it('generates block action message with custom threshold', () => {
    const budgets: OrgBudget[] = [
      { orgId: 'org_1', resource: 'ai_requests', limit: 100, period: 'daily', currentSpend: 120 },
    ];
    const thresholds: BudgetThreshold[] = [
      { percent: 100, severity: 'critical', action: 'block' },
    ];

    const alerts = evaluateBudgetAlerts(budgets, thresholds);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.message).toContain('blocked until the next billing period');
  });

  it('has sensible default thresholds', () => {
    expect(DEFAULT_ALERT_THRESHOLDS.length).toBe(4);
    const sorted = [...DEFAULT_ALERT_THRESHOLDS].sort((a, b) => a.percent - b.percent);
    expect(sorted[0]!.severity).toBe('info');
    expect(sorted[sorted.length - 1]!.severity).toBe('critical');
  });
});
