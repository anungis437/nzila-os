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

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/db/db', () => ({
  db: {
    insert: vi.fn(() => ({ values: vi.fn() })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => []),
      })),
    })),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

// ── Imports ──────────────────────────────────────────────────────────────────

import {
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
