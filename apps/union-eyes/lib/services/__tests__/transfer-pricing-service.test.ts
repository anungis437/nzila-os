import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/decimal-safe', () => ({
  moneyToNumber: vi.fn((v: string) => parseFloat(v)),
}));

import { validateBillingRequest, type Invoice } from '../transfer-pricing-service';

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
});
