/**
 * T106 Compliance Service — Unit Tests
 *
 * Tests:
 *   - generateT106Report returns report structure in CAD
 *   - convertToCADForReporting uses exchange rate service
 *   - validateT106Report checks totals
 *   - same-currency (CAD) conversion passes through
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockConvertAmount } = vi.hoisted(() => ({
  mockConvertAmount: vi.fn(),
}));

vi.mock('../exchange-rate-service', () => ({
  ExchangeRateService: {
    getRate: vi.fn(),
    convertAmount: mockConvertAmount,
    getLatestRates: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { T106ComplianceService } from '../t106-compliance-service';
import { Decimal } from 'decimal.js';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('T106ComplianceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConvertAmount.mockResolvedValue({
      amount: new Decimal('100'),
      fromCurrency: 'USD',
      toCurrency: 'CAD',
      rate: new Decimal('1.35'),
      convertedAmount: new Decimal('135'),
      effectiveDate: new Date('2026-01-15'),
    });
  });

  it('generateT106Report returns report structure in CAD', async () => {
    const report = await T106ComplianceService.generateT106Report('org-1', 2025);
    expect(report.reportingCurrency).toBe('CAD');
    expect(report.organizationId).toBe('org-1');
    expect(report.reportingYear).toBe(2025);
    expect(report.revenue).toBeDefined();
    expect(report.operatingExpenses).toBeDefined();
    expect(report.assets).toBeDefined();
    expect(report.liabilities).toBeDefined();
  });

  it('convertToCADForReporting applies exchange rate conversion', async () => {
    const result = await T106ComplianceService.convertToCADForReporting(
      { USD: new Decimal('100') },
      new Date('2026-01-15')
    );

    expect(mockConvertAmount).toHaveBeenCalledWith(
      new Decimal('100'),
      'USD',
      'CAD',
      expect.any(Date)
    );
    expect(result.USD.amountCAD.equals(new Decimal('135'))).toBe(true);
  });

  it('convertToCADForReporting passes through CAD amounts', async () => {
    const result = await T106ComplianceService.convertToCADForReporting(
      { CAD: new Decimal('500') },
      new Date('2026-01-15')
    );

    expect(result.CAD.amountCAD.equals(new Decimal('500'))).toBe(true);
    expect(mockConvertAmount).not.toHaveBeenCalled();
  });

  it('validateT106Report detects mismatched revenue totals', () => {
    const report = {
      organizationId: 'org-1',
      reportingYear: 2025,
      reportingCurrency: 'CAD' as const,
      reportDate: new Date(),
      revenue: {
        memberDues: new Decimal('100'),
        perCapitaTax: new Decimal('50'),
        grants: new Decimal(0),
        investmentIncome: new Decimal(0),
        other: new Decimal(0),
        total: new Decimal('999'), // intentionally wrong
      },
      operatingExpenses: {
        salaries: new Decimal(0), benefits: new Decimal(0), office: new Decimal(0),
        utilities: new Decimal(0), travel: new Decimal(0), communications: new Decimal(0),
        professional: new Decimal(0), other: new Decimal(0), total: new Decimal(0),
      },
      specialExpenses: {
        strikeFund: new Decimal(0), education: new Decimal(0),
        organizing: new Decimal(0), other: new Decimal(0), total: new Decimal(0),
      },
      assets: {
        cash: new Decimal(0), investments: new Decimal(0),
        fixed: new Decimal(0), other: new Decimal(0), total: new Decimal(0),
      },
      liabilities: {
        accounts: new Decimal(0), shortTerm: new Decimal(0),
        longTerm: new Decimal(0), other: new Decimal(0), total: new Decimal(0),
      },
      equity: new Decimal(0),
    };

    const validation = T106ComplianceService.validateT106Report(report);
    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain('Revenue total does not match sum of components');
  });
});
