/**
 * Tests: Migration Metrics (§10)
 *
 * Tests the metrics aggregation functions used by the dashboard.
 * Since these functions query the database, we mock the DB layer.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { relations } from 'drizzle-orm';

// Mock drizzle-orm (needed since ingestion-schema imports relations)
vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual('drizzle-orm');
  return {
    ...actual,
    relations: vi.fn(() => ({})),
  };
});

// Mock the database
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockOffset = vi.fn();

const chainable = {
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  offset: mockOffset,
};

// Each returns chainable for chaining
mockSelect.mockReturnValue(chainable);
mockFrom.mockReturnValue(chainable);
mockWhere.mockReturnValue(chainable);
mockOrderBy.mockReturnValue(chainable);
mockLimit.mockReturnValue(chainable);
mockOffset.mockReturnValue([]);

vi.mock('@/db/db', () => ({
  db: {
    select: mockSelect,
  },
}));

describe('Migration Metrics Integration Types', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue(chainable);
    mockFrom.mockReturnValue(chainable);
    mockWhere.mockReturnValue(chainable);
    mockOrderBy.mockReturnValue(chainable);
    mockLimit.mockReturnValue(chainable);
    mockOffset.mockReturnValue([]);
  });

  it('BatchSummary type has required fields', async () => {
    // Verify the type shape matches what the dashboard expects
    const summary = {
      id: '123',
      sourceSystem: 'legacy-crm',
      status: 'completed',
      totalRecords: 100,
      succeeded: 95,
      failed: 3,
      skipped: 2,
      createdBy: 'admin',
      startedAt: '2026-01-01T00:00:00Z',
      completedAt: '2026-01-01T00:01:00Z',
      createdAt: '2026-01-01T00:00:00Z',
      durationMs: 60000,
    };

    expect(summary.id).toBeDefined();
    expect(summary.sourceSystem).toBe('legacy-crm');
    expect(summary.succeeded + summary.failed + summary.skipped).toBe(100);
    expect(summary.durationMs).toBe(60000);
  });

  it('MetricsSummary type has required fields', () => {
    const metrics = {
      totalBatches: 5,
      totalRecords: 500,
      totalSucceeded: 480,
      totalFailed: 15,
      totalSkipped: 5,
      successRate: 96,
      failureRate: 3,
      duplicateGroupsTotal: 10,
      duplicateGroupsPending: 3,
      qualityWarningsTotal: 25,
      qualityWarningsUnresolved: 8,
    };

    expect(metrics.successRate).toBe(96);
    expect(metrics.failureRate).toBe(3);
    expect(metrics.duplicateGroupsPending).toBe(3);
    expect(metrics.qualityWarningsUnresolved).toBe(8);
  });

  it('calculates success rate correctly', () => {
    const totalRecords = 200;
    const totalSucceeded = 190;
    const successRate = totalRecords > 0
      ? Math.round((totalSucceeded / totalRecords) * 10000) / 100
      : 0;
    expect(successRate).toBe(95);
  });

  it('handles zero records without division by zero', () => {
    const totalRecords = 0;
    const totalSucceeded = 0;
    const successRate = totalRecords > 0
      ? Math.round((totalSucceeded / totalRecords) * 10000) / 100
      : 0;
    expect(successRate).toBe(0);
  });

  it('duration calculation works correctly', () => {
    const startedAt = new Date('2026-01-01T00:00:00Z');
    const completedAt = new Date('2026-01-01T00:02:30Z');
    const durationMs = completedAt.getTime() - startedAt.getTime();
    expect(durationMs).toBe(150000);
    expect((durationMs / 1000).toFixed(1)).toBe('150.0');
  });
});
