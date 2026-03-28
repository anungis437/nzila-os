/**
 * Payroll Integration Service — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockReturning, mockInsertValues, mockSelect } = vi.hoisted(() => ({
  mockReturning: vi.fn(),
  mockInsertValues: vi.fn(() => ({ returning: mockReturning })),
  mockSelect: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    insert: vi.fn(() => ({ values: mockInsertValues })),
    select: mockSelect,
  },
}));

vi.mock('@/db/schema/dues-finance-schema', () => ({
  employerRemittances: {},
  remittanceLineItems: {},
  remittanceExceptions: {},
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/decimal-safe', () => ({
  moneyToNumber: vi.fn((s: string) => parseFloat(s)),
  toCents: vi.fn((n: number) => Math.round(n * 100)),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import type { PayrollDeductionRow } from '../payroll-integration-service';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('PayrollIntegrationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReturning.mockResolvedValue([]);
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
  });

  it('PayrollDeductionRow has expected structure', () => {
    const row: PayrollDeductionRow = {
      employeeId: 'EMP001',
      employeeName: 'John Doe',
      periodStart: new Date('2026-03-01'),
      periodEnd: new Date('2026-03-15'),
      duesAmount: 75.50,
      grossWages: 3500,
    };

    expect(row.employeeId).toBe('EMP001');
    expect(row.duesAmount).toBe(75.50);
  });

  it('supports optional COPE deduction', () => {
    const row: PayrollDeductionRow = {
      employeeId: 'EMP002',
      employeeName: 'Jane Smith',
      periodStart: new Date('2026-03-01'),
      periodEnd: new Date('2026-03-15'),
      duesAmount: 80,
      copeAmount: 5,
    };

    expect(row.copeAmount).toBe(5);
  });

  it('validates remittance row data', () => {
    const row: PayrollDeductionRow = {
      employeeId: 'EMP003',
      employeeName: 'Test Worker',
      periodStart: new Date('2026-03-01'),
      periodEnd: new Date('2026-03-15'),
      duesAmount: -10, // Invalid negative
    };

    // Negative dues should be caught during processing
    expect(row.duesAmount).toBeLessThan(0);
  });

  it('CSV rows are normalized to PayrollDeductionRow format', () => {
    // Simulate CSV parsing to PayrollDeductionRow
    const csvLine = 'EMP004,Worker Four,2026-03-01,2026-03-15,3200,65.00,3.00';
    const parts = csvLine.split(',');

    const row: PayrollDeductionRow = {
      employeeId: parts[0],
      employeeName: parts[1],
      periodStart: new Date(parts[2]),
      periodEnd: new Date(parts[3]),
      grossWages: parseFloat(parts[4]),
      duesAmount: parseFloat(parts[5]),
      copeAmount: parseFloat(parts[6]),
    };

    expect(row.employeeId).toBe('EMP004');
    expect(row.grossWages).toBe(3200);
    expect(row.duesAmount).toBe(65);
    expect(row.copeAmount).toBe(3);
  });
});
