import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = { send: mocks.mockSend };
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { FinancialEmailService } from '../financial-email-service';
import { Decimal } from 'decimal.js';

describe('FinancialEmailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockSend.mockResolvedValue({ id: 'email-1' });
  });

  describe('sendPaymentConfirmation', () => {
    const params = {
      to: 'member@test.com',
      memberName: 'John Doe',
      transactionId: 'txn-123',
      amount: new Decimal('150.00'),
      currency: 'CAD',
      paymentMethod: 'credit_card',
      paymentDate: new Date('2026-03-01'),
    };

    it('sends payment confirmation email', async () => {
      await FinancialEmailService.sendPaymentConfirmation(params);
      expect(mocks.mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'member@test.com',
          subject: expect.stringContaining('Payment Confirmed'),
        }),
      );
    });

    it('includes amount in subject', async () => {
      await FinancialEmailService.sendPaymentConfirmation(params);
      const call = mocks.mockSend.mock.calls[0][0];
      expect(call.subject).toContain('150.00');
    });

    it('throws on send failure', async () => {
      mocks.mockSend.mockRejectedValue(new Error('Send failed'));
      await expect(FinancialEmailService.sendPaymentConfirmation(params)).rejects.toThrow('Send failed');
    });
  });

  describe('sendPaymentFailure', () => {
    const params = {
      to: 'member@test.com',
      memberName: 'Jane Doe',
      amount: new Decimal('75.00'),
      currency: 'CAD',
      failureReason: 'Insufficient funds',
      failureDate: new Date('2026-03-01'),
      supportEmail: 'support@union.com',
    };

    it('sends payment failure email', async () => {
      await FinancialEmailService.sendPaymentFailure(params);
      expect(mocks.mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'member@test.com',
          subject: expect.stringContaining('Payment Failed'),
        }),
      );
    });

    it('throws on send failure', async () => {
      mocks.mockSend.mockRejectedValue(new Error('API error'));
      await expect(FinancialEmailService.sendPaymentFailure(params)).rejects.toThrow('API error');
    });
  });

  describe('sendInvoice', () => {
    const params = {
      to: 'customer@test.com',
      customerName: 'ACME Corp',
      invoiceNumber: 'INV-2026-001',
      invoiceDate: new Date('2026-03-01'),
      dueDate: new Date('2026-03-31'),
      amount: new Decimal('500.00'),
      currency: 'CAD',
      invoicePdfUrl: 'https://storage.example.com/inv.pdf',
    };

    it('sends invoice email with PDF attachment', async () => {
      await FinancialEmailService.sendInvoice(params);
      expect(mocks.mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({ filename: 'invoice-INV-2026-001.pdf' }),
          ]),
        }),
      );
    });

    it('sends without attachment when no PDF url', async () => {
      const noAttach = { ...params, invoicePdfUrl: '' };
      await FinancialEmailService.sendInvoice(noAttach);
      expect(mocks.mockSend).toHaveBeenCalled();
    });
  });

  describe('sendReceipt', () => {
    it('sends receipt email', async () => {
      await FinancialEmailService.sendReceipt({
        to: 'member@test.com',
        memberName: 'Test User',
        receiptNumber: 'REC-001',
        amount: new Decimal('99.99'),
        currency: 'CAD',
        paymentDate: new Date('2026-03-01'),
      });
      expect(mocks.mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'Receipt #REC-001' }),
      );
    });
  });

  describe('sendPaymentReminder', () => {
    it('sends overdue reminder', async () => {
      await FinancialEmailService.sendPaymentReminder({
        to: 'member@test.com',
        memberName: 'Late Payer',
        dueAmount: new Decimal('200.00'),
        currency: 'CAD',
        dueDate: new Date('2026-02-01'),
        daysOverdue: 15,
        paymentUrl: 'https://pay.example.com/pay',
      });
      expect(mocks.mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('Overdue'),
        }),
      );
    });

    it('sends upcoming reminder', async () => {
      await FinancialEmailService.sendPaymentReminder({
        to: 'member@test.com',
        memberName: 'Early Payer',
        dueAmount: new Decimal('200.00'),
        currency: 'CAD',
        dueDate: new Date('2026-04-01'),
        daysOverdue: -5,
        paymentUrl: 'https://pay.example.com/pay',
      });
      expect(mocks.mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('Reminder'),
        }),
      );
    });
  });

  describe('sendAutopayConfirmation', () => {
    it('sends autopay confirmation', async () => {
      await FinancialEmailService.sendAutopayConfirmation({
        to: 'member@test.com',
        memberName: 'Auto Payer',
        frequency: 'monthly',
        amount: new Decimal('50.00'),
        currency: 'CAD',
        nextChargeDate: new Date('2026-04-01'),
      });
      expect(mocks.mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('AutoPay'),
        }),
      );
    });
  });

  describe('sendAutopayDisabled', () => {
    it('sends autopay disabled notification', async () => {
      await FinancialEmailService.sendAutopayDisabled({
        to: 'member@test.com',
        memberName: 'Failed Payer',
        failureCount: 3,
        lastFailureReason: 'Card expired',
        updatePaymentUrl: 'https://pay.example.com/update',
      });
      expect(mocks.mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('AutoPay Disabled'),
        }),
      );
    });
  });
});
