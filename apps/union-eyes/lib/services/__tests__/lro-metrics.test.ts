/**
 * LRO Metrics — Unit Tests
 *
 * Tests:
 *   - calculateSLAComplianceRate: pure computation
 *   - calculateAvgResolutionTime: pure computation
 *   - calculateSignalActionRate: pure computation
 *   - getTopPerformingOfficers: pure sorting
 *   - trackMetric: buffer insertion
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
  trackMetric,
} from '../lro-metrics';

// ── Tests ────────────────────────────────────────────────────────────────────

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
    const resolved = new Date('2026-01-02T00:00:00Z'); // 24 hours later
    const result = calculateAvgResolutionTime([
      { createdAt: created, resolvedAt: resolved },
    ]);
    expect(result).toBeCloseTo(24, 0);
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
    expect(result[0].officerId).toBe('o3'); // 95% compliance + 15 cases
    expect(result[1].officerId).toBe('o2'); // 95% compliance + 5 cases
    expect(result[2].officerId).toBe('o1');
  });

  it('respects limit parameter', () => {
    const metrics = [
      { officerId: 'o1', officerName: 'A', casesResolved: 10, avgResolutionHours: 8, slaComplianceRate: 90 },
      { officerId: 'o2', officerName: 'B', casesResolved: 5, avgResolutionHours: 4, slaComplianceRate: 95 },
      { officerId: 'o3', officerName: 'C', casesResolved: 15, avgResolutionHours: 12, slaComplianceRate: 80 },
    ];
    const result = getTopPerformingOfficers(metrics, 2);
    expect(result.length).toBe(2);
  });
});

describe('trackMetric', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('buffers event without throwing', async () => {
    await expect(
      trackMetric('case_created', { caseId: 'c-1' }, { userId: 'u-1' })
    ).resolves.toBeUndefined();
  });
});
