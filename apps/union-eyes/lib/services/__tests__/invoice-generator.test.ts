import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import { InvoiceGenerator, type InvoiceData } from '../invoice-generator';

describe('InvoiceGenerator', () => {
  function makeInvoiceData(overrides: Partial<InvoiceData> = {}): InvoiceData {
    return {
      invoiceNumber: 'INV-2026-001',
      invoiceDate: new Date('2026-03-01'),
      dueDate: new Date('2026-03-31'),
      customerName: 'CUPE Local 123',
      customerEmail: 'treasurer@cupe123.ca',
      unionName: 'National Union of Workers',
      unionAddress: {
        line1: '100 Queen St',
        city: 'Ottawa',
        province: 'ON',
        postalCode: 'K1A 0A6',
        country: 'CA',
      },
      unionEmail: 'billing@nuw.ca',
      lineItems: [
        {
          description: 'Monthly Union Dues - March 2026',
          quantity: 1,
          unitPrice: new Decimal('125.00'),
          amount: new Decimal('125.00'),
        },
        {
          description: 'Strike Fund Contribution',
          quantity: 1,
          unitPrice: new Decimal('25.00'),
          amount: new Decimal('25.00'),
        },
      ],
      subtotal: new Decimal('150.00'),
      taxRate: 0.13,
      taxAmount: new Decimal('19.50'),
      totalAmount: new Decimal('169.50'),
      amountPaid: new Decimal('0'),
      amountDue: new Decimal('169.50'),
      ...overrides,
    };
  }

  describe('generateHTML', () => {
    it('returns a valid HTML string', () => {
      const html = InvoiceGenerator.generateHTML(makeInvoiceData());

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('</html>');
    });

    it('includes the invoice number', () => {
      const html = InvoiceGenerator.generateHTML(makeInvoiceData());
      expect(html).toContain('INV-2026-001');
    });

    it('includes line item descriptions', () => {
      const html = InvoiceGenerator.generateHTML(makeInvoiceData());
      expect(html).toContain('Monthly Union Dues - March 2026');
      expect(html).toContain('Strike Fund Contribution');
    });

    it('shows correct totals', () => {
      const html = InvoiceGenerator.generateHTML(makeInvoiceData());
      expect(html).toContain('150.00');
      expect(html).toContain('169.50');
    });

    it('shows PAID stamp when amount due is zero', () => {
      const html = InvoiceGenerator.generateHTML(
        makeInvoiceData({
          amountPaid: new Decimal('169.50'),
          amountDue: new Decimal('0'),
        })
      );
      expect(html).toContain('PAID IN FULL');
    });

    it('shows amount due when not fully paid', () => {
      const html = InvoiceGenerator.generateHTML(makeInvoiceData());
      expect(html).toContain('Amount Due');
      expect(html).not.toContain('PAID IN FULL');
    });

    it('includes union name in header', () => {
      const html = InvoiceGenerator.generateHTML(makeInvoiceData());
      expect(html).toContain('National Union of Workers');
    });
  });
});
