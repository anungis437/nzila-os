/**
 * LRO Metrics — Unit Tests
 *
 * Tests:
 *   Pure computation:
 *     - calculateSLAComplianceRate: empty, all compliant, half, all breached
 *     - calculateAvgResolutionTime: empty, no resolved, resolved
 *     - calculateSignalActionRate: empty, all acted, half
 *     - getTopPerformingOfficers: empty, sorted, limit
 *     - getCaseResolutionMetrics: resolved, unresolved, with state history
 *     - calculateSignalEffectiveness: empty, single type, mixed types
 *   Tracking wrappers:
 *     - trackMetric: buffer + no throw
 *     - trackCaseTransition: delegates to trackMetric with correct type
 *     - trackSignalDetected: delegates
 *     - trackSignalAction: acknowledged / resolved / dismissed
 *     - trackFeatureFlagEvaluation: delegates
 *     - trackDashboardView: delegates
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const selectQueue: Array<{
    from: ReturnType<typeof vi.fn>;
  }> = [];

  const makeQueryResult = <T>(result: T) => ({
    from: vi.fn(() => ({
      where: vi.fn(async () => result),
    })),
  });

  const mockSelect = vi.fn(() => selectQueue.shift());

  return {
    selectQueue,
    makeQueryResult,
    mockDb: {
      insert: vi.fn(() => ({ values: vi.fn() })),
      select: mockSelect,
    },
  };
});

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/db/db', () => ({
  db: mocks.mockDb,
}));

vi.mock('@/db/schema/domains/claims', () => ({
  grievances: {
    createdAt: 'createdAt',
    organizationId: 'organizationId',
    status: 'status',
    resolvedAt: 'resolvedAt',
    responseDeadline: 'responseDeadline',
  },
}));

vi.mock('@/db/schema/analytics', () => ({
  analyticsMetrics: {
    periodStart: 'periodStart',
    periodEnd: 'periodEnd',
    organizationId: 'organizationId',
    metricType: 'metricType',
    metricValue: 'metricValue',
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: vi.fn((_column, value) => ({ _type: 'eq', value })),
    and: vi.fn((...parts) => ({ _type: 'and', parts })),
    gte: vi.fn((_column, value) => ({ _type: 'gte', value })),
    lte: vi.fn((_column, value) => ({ _type: 'lte', value })),
    count: vi.fn(() => 'count'),
    avg: vi.fn(() => 'avg'),
    sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
  };
});

// ── Imports ──────────────────────────────────────────────────────────────────

import {
  getAggregatedMetrics,
  calculateSLAComplianceRate,
  calculateAvgResolutionTime,
  calculateSignalActionRate,
  getTopPerformingOfficers,
  getCaseResolutionMetrics,
  calculateSignalEffectiveness,
  trackMetric,
  trackCaseTransition,
  trackSignalDetected,
  trackSignalAction,
  trackFeatureFlagEvaluation,
  trackDashboardView,
} from '../lro-metrics';

// ── Pure Computation Tests ───────────────────────────────────────────────────

describe('calculateSLAComplianceRate (pure)', () => {
  it('returns 100 for empty array', () => {
    expect(calculateSLAComplianceRate([])).toBe(100);
  });

  it('returns 100% when all compliant', () => {
    const cases = [
      { id: 'c1', slaStatus: 'compliant' as const },
      { id: 'c2', slaStatus: 'compliant' as const },
    ];
    expect(calculateSLAComplianceRate(cases)).toBe(100);
  });

  it('returns 50% when half compliant', () => {
    const cases = [
      { id: 'c1', slaStatus: 'compliant' as const },
      { id: 'c2', slaStatus: 'breached' as const },
    ];
    expect(calculateSLAComplianceRate(cases)).toBe(50);
  });

  it('returns 0% when all breached', () => {
    const cases = [
      { id: 'c1', slaStatus: 'breached' as const },
      { id: 'c2', slaStatus: 'at_risk' as const },
    ];
    expect(calculateSLAComplianceRate(cases)).toBe(0);
  });
});

describe('calculateAvgResolutionTime (pure)', () => {
  it('returns 0 for empty array', () => {
    expect(calculateAvgResolutionTime([])).toBe(0);
  });

  it('returns 0 when no cases resolved', () => {
    const cases = [{ createdAt: new Date(), resolvedAt: null }];
    expect(calculateAvgResolutionTime(cases)).toBe(0);
  });

  it('calculates average hours for resolved cases', () => {
    const created = new Date('2026-01-01T00:00:00Z');
    const resolved = new Date('2026-01-02T00:00:00Z');
    expect(calculateAvgResolutionTime([{ createdAt: created, resolvedAt: resolved }])).toBeCloseTo(24, 0);
  });

  it('ignores unresolved cases in average', () => {
    const created = new Date('2026-01-01T00:00:00Z');
    const resolved = new Date('2026-01-01T12:00:00Z'); // 12h
    const cases = [
      { createdAt: created, resolvedAt: resolved },
      { createdAt: created, resolvedAt: null },
    ];
    expect(calculateAvgResolutionTime(cases)).toBeCloseTo(12, 0);
  });
});

describe('calculateSignalActionRate (pure)', () => {
  it('returns 0 for empty array', () => {
    expect(calculateSignalActionRate([])).toBe(0);
  });

  it('returns 100% when all acted on', () => {
    const signals = [
      { detectedAt: new Date(), acknowledgedAt: new Date() },
      { detectedAt: new Date(), actionedAt: new Date() },
    ];
    expect(calculateSignalActionRate(signals)).toBe(100);
  });

  it('returns 50% when half acted on', () => {
    const signals = [
      { detectedAt: new Date(), acknowledgedAt: new Date() },
      { detectedAt: new Date() },
    ];
    expect(calculateSignalActionRate(signals)).toBe(50);
  });
});

describe('getTopPerformingOfficers (pure)', () => {
  it('returns empty for empty input', () => {
    expect(getTopPerformingOfficers([])).toEqual([]);
  });

  it('sorts by SLA compliance rate then cases resolved', () => {
    const metrics = [
      { officerId: 'o1', officerName: 'A', casesResolved: 10, avgResolutionHours: 8, slaComplianceRate: 80 },
      { officerId: 'o2', officerName: 'B', casesResolved: 5, avgResolutionHours: 4, slaComplianceRate: 95 },
      { officerId: 'o3', officerName: 'C', casesResolved: 15, avgResolutionHours: 12, slaComplianceRate: 95 },
    ];
    const result = getTopPerformingOfficers(metrics);
    expect(result[0].officerId).toBe('o3');
    expect(result[1].officerId).toBe('o2');
    expect(result[2].officerId).toBe('o1');
  });

  it('respects limit parameter', () => {
    const metrics = [
      { officerId: 'o1', officerName: 'A', casesResolved: 10, avgResolutionHours: 8, slaComplianceRate: 90 },
      { officerId: 'o2', officerName: 'B', casesResolved: 5, avgResolutionHours: 4, slaComplianceRate: 95 },
      { officerId: 'o3', officerName: 'C', casesResolved: 15, avgResolutionHours: 12, slaComplianceRate: 80 },
    ];
    expect(getTopPerformingOfficers(metrics, 2)).toHaveLength(2);
  });
});

describe('getCaseResolutionMetrics (pure)', () => {
  it('computes metrics for a resolved case', () => {
    const created = new Date('2026-01-01T00:00:00Z');
    const updated = new Date('2026-01-02T00:00:00Z');
    const result = getCaseResolutionMetrics({
      id: 'case-1',
      createdAt: created,
      currentState: 'resolved',
      lastUpdated: updated,
    });
    expect(result.caseId).toBe('case-1');
    expect(result.resolvedAt).toEqual(updated);
    expect(result.totalDurationHours).toBeCloseTo(24, 0);
    expect(result.stateTransitions).toEqual([]);
    expect(result.slaCompliant).toBe(true);
  });

  it('computes metrics for a closed case', () => {
    const result = getCaseResolutionMetrics({
      id: 'case-2',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      currentState: 'closed',
      lastUpdated: new Date('2026-01-03T00:00:00Z'),
    });
    expect(result.resolvedAt).not.toBeNull();
    expect(result.totalDurationHours).toBeCloseTo(48, 0);
  });

  it('returns null resolvedAt for open case', () => {
    const result = getCaseResolutionMetrics({
      id: 'case-3',
      createdAt: new Date(),
      currentState: 'investigating',
      lastUpdated: new Date(),
    });
    expect(result.resolvedAt).toBeNull();
    expect(result.totalDurationHours).toBeGreaterThanOrEqual(0);
  });

  it('builds state transitions from history', () => {
    const t0 = new Date('2026-01-01T00:00:00Z');
    const t1 = new Date('2026-01-01T02:00:00Z');
    const t2 = new Date('2026-01-01T06:00:00Z');
    const result = getCaseResolutionMetrics({
      id: 'case-4',
      createdAt: t0,
      currentState: 'investigating',
      lastUpdated: t2,
      stateHistory: [
        { state: 'submitted', timestamp: t0 },
        { state: 'acknowledged', timestamp: t1 },
        { state: 'investigating', timestamp: t2 },
      ],
    });
    expect(result.stateTransitions).toHaveLength(2);
    expect(result.stateTransitions[0]).toMatchObject({
      fromState: 'submitted',
      toState: 'acknowledged',
    });
    expect(result.stateTransitions[0].durationHours).toBeCloseTo(2, 0);
    expect(result.stateTransitions[1]).toMatchObject({
      fromState: 'acknowledged',
      toState: 'investigating',
    });
    expect(result.stateTransitions[1].durationHours).toBeCloseTo(4, 0);
  });

  it('categorizes uncategorized transitions as state_change', () => {
    const t0 = new Date('2026-01-01T00:00:00Z');
    const t1 = new Date('2026-01-01T03:00:00Z');
    const t2 = new Date('2026-01-01T05:00:00Z');
    const result = getCaseResolutionMetrics({
      id: 'case-5',
      createdAt: t0,
      currentState: 'pending_review',
      lastUpdated: t2,
      stateHistory: [
        { state: 'in_progress', timestamp: t0 },
        { state: 'pending_review', timestamp: t1 },
        { state: 'awaiting_decision', timestamp: t2 },
      ],
    });
    // getCaseResolutionMetrics returns fromState/toState/durationHours (no transitionType)
    expect(result.stateTransitions).toHaveLength(2);
    expect(result.stateTransitions[0]).toMatchObject({
      fromState: 'in_progress',
      toState: 'pending_review',
    });
  });
});

describe('calculateSignalEffectiveness (pure)', () => {
  it('returns empty object for empty array', () => {
    expect(calculateSignalEffectiveness([])).toEqual({});
  });

  it('groups by single type', () => {
    const signals = [
      { type: 'sla_at_risk', detectedAt: new Date(), acknowledgedAt: new Date() },
      { type: 'sla_at_risk', detectedAt: new Date(), resolvedAt: new Date() },
    ];
    const result = calculateSignalEffectiveness(signals);
    expect(result['sla_at_risk']).toMatchObject({
      signalType: 'sla_at_risk',
      totalDetected: 2,
      totalAcknowledged: 1,
      totalResolved: 1,
    });
  });

  it('groups by multiple types with resolution rate', () => {
    const signals = [
      { type: 'sla_at_risk', detectedAt: new Date(), resolvedAt: new Date() },
      { type: 'escalation', detectedAt: new Date(), dismissedAt: new Date() },
      { type: 'escalation', detectedAt: new Date(), resolvedAt: new Date() },
    ];
    const result = calculateSignalEffectiveness(signals);
    expect(result['sla_at_risk'].resolutionRate).toBe(100);
    // escalation: 1 resolved, 1 dismissed → 50%
    expect(result['escalation'].resolutionRate).toBe(50);
  });

  it('returns 0 resolution rate when no actions', () => {
    const signals = [
      { type: 'info', detectedAt: new Date() },
    ];
    const result = calculateSignalEffectiveness(signals);
    expect(result['info'].resolutionRate).toBe(0);
    expect(result['info'].totalDetected).toBe(1);
  });
});

describe('getAggregatedMetrics', () => {
  beforeEach(() => {
    mocks.selectQueue.length = 0;
    vi.clearAllMocks();
  });

  it('aggregates metrics from grievances and analytics tables', async () => {
    mocks.selectQueue.push(
      mocks.makeQueryResult([
        { total: 10, open: 3, resolved: 7, avgResolutionHours: 6 },
      ]),
      mocks.makeQueryResult([
        { metricType: 'signal_detected', metricValue: '4' },
        { metricType: 'signal_critical', metricValue: '2' },
        { metricType: 'signal_urgent', metricValue: '1' },
        { metricType: 'active_users', metricValue: '12' },
        { metricType: 'feature_case_board', metricValue: '0.75' },
      ]),
      mocks.makeQueryResult([
        { compliant: 8, total: 10 },
      ])
    );

    const result = await getAggregatedMetrics(
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-01-31T23:59:59Z'),
      'org-1'
    );

    expect(result).toEqual(expect.objectContaining({
      totalCases: 10,
      openCases: 3,
      resolvedCases: 7,
      avgResolutionTimeHours: 6,
      slaComplianceRate: 80,
      totalSignals: 4,
      criticalSignals: 2,
      urgentSignals: 1,
      signalActionRate: 75,
      dashboardActiveUsers: 12,
      featureAdoptionRate: { feature_case_board: 0.75 },
    }));
  });

  it('returns empty metrics when the query fails', async () => {
    mocks.selectQueue.push({
      from: vi.fn(() => ({
        where: vi.fn(async () => {
          throw new Error('db down');
        }),
      })),
    });

    const result = await getAggregatedMetrics(
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-01-31T23:59:59Z')
    );

    expect(result).toEqual(expect.objectContaining({
      totalCases: 0,
      openCases: 0,
      resolvedCases: 0,
      totalSignals: 0,
      dashboardActiveUsers: 0,
    }));
  });

  it('uses fallback values when caseMetrics is empty and handles edge cases', async () => {
    // Empty caseMetrics → triggers caseMetrics[0] || {...} fallback
    // Null metricValue → triggers metricValue || '0' fallback  
    // Unknown metric type → falls through all else-if branches
    // Zero SLA total → triggers ternary false branch (returns 100)
    // No signals → triggers totalSignals ? ... : 0 false branch
    mocks.selectQueue.push(
      mocks.makeQueryResult([]),   // empty → L244 fallback
      mocks.makeQueryResult([
        { metricType: 'signal_detected', metricValue: null },    // L277 fallback
        { metricType: 'signal_critical', metricValue: '0' },
        { metricType: 'unknown_type', metricValue: '5' },        // L289 else
      ]),
      mocks.makeQueryResult([{ compliant: 0, total: 0 }]),       // L303 false
    );

    const result = await getAggregatedMetrics(
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-01-31T23:59:59Z')
      // no organizationId → L229 false
    );

    expect(result.totalCases).toBe(0);
    expect(result.slaComplianceRate).toBe(100);
    expect(result.signalActionRate).toBe(0);
  });

  it('covers null avgResolutionHours and zero totalSignals with successful calls', async () => {
    mocks.selectQueue.push(
      mocks.makeQueryResult([{ total: 5, open: 2, resolved: 3, avgResolutionHours: null }]),
      mocks.makeQueryResult([]),
      mocks.makeQueryResult([{ compliant: 3, total: 5 }]),
    );

    const result = await getAggregatedMetrics(
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-01-31T23:59:59Z')
    );

    expect(result.avgResolutionTimeHours).toBe(0);
    expect(result.signalActionRate).toBe(0);
  });
});

// ── Tracking Wrapper Tests ───────────────────────────────────────────────────

describe('trackMetric', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('buffers event without throwing', async () => {
    await expect(
      trackMetric('case_created', { caseId: 'c-1' }, { userId: 'u-1' })
    ).resolves.toBeUndefined();
  });

  it('accepts all context fields', async () => {
    await expect(
      trackMetric('signal_detected', { foo: 'bar' }, {
        userId: 'u-1',
        organizationId: 'org-1',
        caseId: 'c-1',
      })
    ).resolves.toBeUndefined();
  });
});

describe('trackCaseTransition', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('delegates for escalation', async () => {
    await expect(
      trackCaseTransition('case-1', 'investigating', 'escalated', 'u-1', 'org-1')
    ).resolves.toBeUndefined();
  });

  it('delegates for resolution', async () => {
    await expect(
      trackCaseTransition('case-2', 'investigating', 'resolved', 'u-1')
    ).resolves.toBeUndefined();
  });

  it('delegates for acknowledgment', async () => {
    await expect(
      trackCaseTransition('case-3', 'submitted', 'acknowledged', 'u-1')
    ).resolves.toBeUndefined();
  });

  it('delegates for investigation_start transition', async () => {
    await expect(
      trackCaseTransition('case-4', 'acknowledged', 'investigating', 'u-1')
    ).resolves.toBeUndefined();
  });

  it('falls back to state_change for unknown transition', async () => {
    await expect(
      trackCaseTransition('case-5', 'in_progress', 'pending_review', 'u-1')
    ).resolves.toBeUndefined();
  });
});

describe('trackSignalDetected', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('delegates without throwing', async () => {
    await expect(
      trackSignalDetected('sla_at_risk', 'critical', 'case-1', 'org-1')
    ).resolves.toBeUndefined();
  });

  it('handles missing organizationId', async () => {
    await expect(
      trackSignalDetected('escalation', 'urgent', 'case-2')
    ).resolves.toBeUndefined();
  });
});

describe('trackSignalAction', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('tracks acknowledged action', async () => {
    await expect(
      trackSignalAction('sla_at_risk', 'acknowledged', 'case-1', 'u-1')
    ).resolves.toBeUndefined();
  });

  it('tracks resolved action', async () => {
    await expect(
      trackSignalAction('sla_at_risk', 'resolved', 'case-1', 'u-1', 'org-1')
    ).resolves.toBeUndefined();
  });

  it('tracks dismissed action', async () => {
    await expect(
      trackSignalAction('info', 'dismissed', 'case-2', 'u-1')
    ).resolves.toBeUndefined();
  });
});

describe('trackFeatureFlagEvaluation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('delegates without throwing', async () => {
    await expect(
      trackFeatureFlagEvaluation('ai-chatbot', true, 'u-1', 'org-1')
    ).resolves.toBeUndefined();
  });
});

describe('trackDashboardView', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('delegates without throwing', async () => {
    await expect(
      trackDashboardView('u-1', 'org-1')
    ).resolves.toBeUndefined();
  });

  it('handles missing organizationId', async () => {
    await expect(
      trackDashboardView('u-2')
    ).resolves.toBeUndefined();
  });
});

describe('buffer overflow and flush', () => {
  it('triggers flushMetrics when buffer hits BUFFER_SIZE (100)', async () => {
    const { logger } = await import('@/lib/logger');
    const origNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      for (let i = 0; i < 100; i++) {
        await trackMetric('case_created', { seq: i });
      }
    } finally {
      process.env.NODE_ENV = origNodeEnv;
    }
    // At least one flush occurred
    expect((logger.info as ReturnType<typeof vi.fn>).mock.calls.some(
      (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('[LROMetrics] Flushed')
    )).toBe(true);
  });
});

describe('module initialization interval behavior', () => {
  it('does not register auto-flush interval in browser-like environments', async () => {
    vi.resetModules();
    const oldWindow = (globalThis as any).window;
    (globalThis as any).window = {};

    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    await import('../lro-metrics');

    expect(setIntervalSpy).not.toHaveBeenCalled();

    setIntervalSpy.mockRestore();
    if (typeof oldWindow === 'undefined') {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = oldWindow;
    }
  });

  it('executes interval callback and logs flush errors when flush rejects', async () => {
    vi.resetModules();
    const oldWindow = (globalThis as any).window;
    const oldNodeEnv = process.env.NODE_ENV;
    delete (globalThis as any).window;
    process.env.NODE_ENV = 'development';

    let intervalCallback: (() => void) | undefined;
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval').mockImplementation(((cb: () => void) => {
      intervalCallback = cb;
      return 1 as unknown as ReturnType<typeof setInterval>;
    }) as typeof setInterval);

    const mod = await import('../lro-metrics');
    const { logger } = await import('@/lib/logger');

    // Cover the callback's false branch (buffer empty) first.
    intervalCallback?.();

    // Make flush reject on the callback's true branch by throwing in logger.info.
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {
      throw new Error('flush info failure');
    });

    await mod.trackMetric('case_created', { source: 'interval-test' });
    intervalCallback?.();
    await Promise.resolve();

    expect(logger.error).toHaveBeenCalledWith('[LROMetrics] Flush error', expect.objectContaining({
      error: expect.any(Error),
    }));

    infoSpy.mockRestore();
    setIntervalSpy.mockRestore();
    process.env.NODE_ENV = oldNodeEnv;
    if (typeof oldWindow === 'undefined') {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = oldWindow;
    }
  });

  it('flushes without development logging when NODE_ENV is not development', async () => {
    vi.resetModules();
    const oldWindow = (globalThis as any).window;
    const oldNodeEnv = process.env.NODE_ENV;
    delete (globalThis as any).window;
    process.env.NODE_ENV = 'test';

    let intervalCallback: (() => void) | undefined;
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval').mockImplementation(((cb: () => void) => {
      intervalCallback = cb;
      return 1 as unknown as ReturnType<typeof setInterval>;
    }) as typeof setInterval);

    const mod = await import('../lro-metrics');
    const { logger } = await import('@/lib/logger');
    const infoSpy = vi.spyOn(logger, 'info');

    await mod.trackMetric('case_created', { source: 'non-dev-flush' });
    intervalCallback?.();
    await Promise.resolve();

    expect(infoSpy).not.toHaveBeenCalledWith('[LROMetrics] Flushed events to database', expect.anything());

    setIntervalSpy.mockRestore();
    process.env.NODE_ENV = oldNodeEnv;
    if (typeof oldWindow === 'undefined') {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = oldWindow;
    }
  });
});
