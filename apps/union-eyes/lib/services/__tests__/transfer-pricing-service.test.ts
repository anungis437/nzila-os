import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/decimal-safe', () => ({
  moneyToNumber: vi.fn((v: string) => parseFloat(v)),
}));

import {
  validateBillingRequest,
  checkT106Requirement,
  fileT106,
  getT106FilingStatus,
  validateTransferPricingDocumentation,
  generateTransferPricingReport,
  type Invoice,
  type CrossBorderTransaction,
} from '../transfer-pricing-service';

describe('transfer-pricing-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateBillingRequest', () => {
    it('returns valid=true for CAD invoices', async () => {
      const invoice: Invoice = {
        invoiceId: 'INV-001',
        currency: 'CAD',
        amount: 5000,
        date: new Date('2026-03-15'),
      };

      const result = await validateBillingRequest(invoice);

      expect(result.valid).toBe(true);
      expect(result.requiredCurrency).toBe('CAD');
    });

    it('returns valid=false for USD invoices with conversion info', async () => {
      // Mock fetch for Bank of Canada API
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              observations: [
                { FXUSDCAD: { v: '1.3500' } },
              ],
            }),
        })
      );

      const invoice: Invoice = {
        invoiceId: 'INV-002',
        currency: 'USD',
        amount: 1000,
        date: new Date('2026-03-15'),
      };

      const result = await validateBillingRequest(invoice);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('must convert to CAD');
      expect(result.convertedAmount).toBeDefined();

      vi.unstubAllGlobals();
    });

    it('returns valid=false for unsupported currencies', async () => {
      const invoice: Invoice = {
        invoiceId: 'INV-003',
        currency: 'GBP',
        amount: 2000,
        date: new Date('2026-03-15'),
      };

      const result = await validateBillingRequest(invoice);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported currency');
      expect(result.requiredCurrency).toBe('CAD');
    });

    it('handles USD conversion failure gracefully', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('Network error'))
      );

      const invoice: Invoice = {
        invoiceId: 'INV-004',
        currency: 'USD',
        amount: 500,
        date: new Date('2026-03-15'),
      };

      const result = await validateBillingRequest(invoice);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Cannot convert');

      vi.unstubAllGlobals();
    });
  });

  describe('checkT106Requirement', () => {
    it('not related party → no T106', async () => {
      const r = await checkT106Requirement(2000000, false);
      expect(r.requiresT106).toBe(false);
      expect(r.reason).toContain("arm's length");
    });

    it('related party over threshold → T106 required', async () => {
      const r = await checkT106Requirement(1500000, true);
      expect(r.requiresT106).toBe(true);
      expect(r.reason).toContain('exceeds $1M threshold');
    });

    it('related party under threshold → no T106', async () => {
      const r = await checkT106Requirement(500000, true);
      expect(r.requiresT106).toBe(false);
      expect(r.reason).toContain('under');
    });
  });

  describe('fileT106', () => {
    const makeTransaction = (amountCAD: number, isRelatedParty = true): CrossBorderTransaction => ({
      transactionId: 'tx-1',
      date: new Date('2026-01-15'),
      amountCAD,
      counterpartyName: 'Subsidiary Inc',
      counterpartyCountry: 'US',
      isRelatedParty,
      transactionType: 'service',
    });

    it('returns filed=false when no eligible transactions', async () => {
      const r = await fileT106(2025, [makeTransaction(500000)]);
      expect(r.filed).toBe(false);
      expect(r.t106Count).toBe(0);
      expect(r.deadline).toEqual(new Date('2026-06-30'));
    });

    it('returns filed=true with count when eligible transactions exist', async () => {
      const r = await fileT106(2025, [makeTransaction(1500000), makeTransaction(2000000)]);
      expect(r.filed).toBe(true);
      expect(r.t106Count).toBe(2);
    });
  });

  describe('getT106FilingStatus', () => {
    it('returns status with deadline and days remaining', async () => {
      const r = await getT106FilingStatus(2025);
      expect(r.deadline).toEqual(new Date('2026-06-30'));
      expect(typeof r.daysUntilDeadline).toBe('number');
      expect(r.requiresFiling).toBe(false);
    });
  });

  describe('validateTransferPricingDocumentation', () => {
    it('returns compliant for arm-length transactions', async () => {
      const r = await validateTransferPricingDocumentation({
        transactionId: 'tx-1',
        date: new Date(),
        amountCAD: 500000,
        counterpartyName: 'Third Party',
        counterpartyCountry: 'US',
        isRelatedParty: false,
        transactionType: 'service',
      });
      expect(r.compliant).toBe(true);
      expect(r.issues).toHaveLength(0);
    });

    it('returns recommendations for large related-party transactions', async () => {
      const r = await validateTransferPricingDocumentation({
        transactionId: 'tx-2',
        date: new Date(),
        amountCAD: 1500000,
        counterpartyName: 'Related Co',
        counterpartyCountry: 'US',
        isRelatedParty: true,
        transactionType: 'management_fee',
      });
      expect(r.compliant).toBe(true); // no issues
      expect(r.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('generateTransferPricingReport', () => {
    it('returns compliant report with recommendations', async () => {
      const r = await generateTransferPricingReport();
      expect(r.compliant).toBe(true);
      expect(r.issues).toHaveLength(0);
      expect(r.recommendations.length).toBeGreaterThan(0);
    });
  });
});
