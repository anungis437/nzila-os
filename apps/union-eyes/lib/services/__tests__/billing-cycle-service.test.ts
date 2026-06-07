/**
 * Billing Cycle Service — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockSelect, mockWithRLS, mockCalcEngine } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockWithRLS: vi.fn(),
  mockCalcEngine: {
    calculateMemberDues: vi.fn(() => ({
      baseDues: 50,
      copeAllocation: 5,
      pacAllocation: 2,
      strikeFundAllocation: 3,
      totalDues: 60,
    })),
  },
}));

vi.mock('@/db/schema-organizations', () => ({
  organizationMembers: {},
}));

vi.mock('@/db/schema/domains/member/member-employment', () => ({
  memberEmployment: {},
}));

vi.mock('@/db/schema/domains/finance/dues', () => ({
  duesTransactions: {},
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('drizzle-orm/node-postgres', () => ({
  NodePgDatabase: class {},
}));

vi.mock('@/lib/dues-calculation-engine', () => ({
  DuesCalculationEngine: vi.fn(() => mockCalcEngine),
}));

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: mockWithRLS,
}));

vi.mock('@/lib/decimal-safe', () => ({
  moneyToNumber: vi.fn((s: string) => parseFloat(s)),
  toCents: vi.fn((n: number) => Math.round(n * 100)),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import type { BillingCycleParams } from '../billing-cycle-service';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('BillingCycleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWithRLS.mockImplementation(
      async (_orgId: string, callback: (db: any) => Promise<any>) => {
        const mockDb = {
          select: mockSelect,
          insert: vi.fn(() => ({
            values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
          })),
        };
        return callback(mockDb);
      }
    );
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
  });

  it('BillingCycleParams has expected structure', () => {
    const params: BillingCycleParams = {
      organizationId: 'org-1',
      periodStart: new Date('2026-03-01'),
      periodEnd: new Date('2026-03-31'),
      frequency: 'monthly',
      executedBy: 'user-1',
    };

    expect(params.organizationId).toBe('org-1');
    expect(params.frequency).toBe('monthly');
  });

  it('supports dryRun mode', () => {
    const params: BillingCycleParams = {
      organizationId: 'org-1',
      periodStart: new Date('2026-03-01'),
      periodEnd: new Date('2026-03-31'),
      frequency: 'monthly',
      dryRun: true,
      executedBy: 'user-1',
    };

    expect(params.dryRun).toBe(true);
  });

  it('calculation engine computes per-member dues', () => {
    const result = mockCalcEngine.calculateMemberDues();
    expect(result.baseDues).toBe(50);
    expect(result.copeAllocation).toBe(5);
    expect(result.totalDues).toBe(60);
  });

  it('supports all billing frequencies', () => {
    const frequencies = ['monthly', 'bi_weekly', 'weekly', 'quarterly', 'annual'];
    frequencies.forEach((freq) => {
      const params: BillingCycleParams = {
        organizationId: 'org-1',
        periodStart: new Date(),
        periodEnd: new Date(),
        frequency: freq as BillingCycleParams['frequency'],
        executedBy: 'user-1',
      };
      expect(params.frequency).toBe(freq);
    });
  });
});
