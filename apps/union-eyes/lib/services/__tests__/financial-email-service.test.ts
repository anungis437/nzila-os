import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockSendResendEmail: vi.fn(),
}));

vi.mock('@/lib/email-service', () => ({
  sendResendEmail: mocks.mockSendResendEmail,
  getFromEmail: (label?: string) => label ? `${label} <noreply@unioneyes.app>` : 'noreply@unioneyes.app',
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { FinancialEmailService } from '../financial-email-service';
import { Decimal } from 'decimal.js';

describe('FinancialEmailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockSendResendEmail.mockResolvedValue({ success: true, messageId: 'email-1' });
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
      expect(mocks.mockSendResendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'member@test.com',
          subject: expect.stringContaining('Payment Confirmed'),
        }),
        expect.anything(),
      );
    });

    it('includes amount in subject', async () => {
      await FinancialEmailService.sendPaymentConfirmation(params);
      const call = mocks.mockSendResendEmail.mock.calls[0][0];
      expect(call.subject).toContain('150.00');
    });

    it('throws on send failure', async () => {
      mocks.mockSendResendEmail.mockRejectedValue(new Error('Send failed'));
      await expect(FinancialEmailService.sendPaymentConfirmation(params)).rejects.toThrow('Send failed');
    });

    it('throws when provider returns a failure object', async () => {
      mocks.mockSendResendEmail.mockResolvedValue({ success: false, error: 'Downstream failure' });
      await expect(FinancialEmailService.sendPaymentConfirmation(params)).rejects.toThrow('Downstream failure');
    });

    it('uses fallback message when provider returns no error string', async () => {
      mocks.mockSendResendEmail.mockResolvedValue({ success: false });
      await expect(FinancialEmailService.sendPaymentConfirmation(params)).rejects.toThrow('Failed to send payment confirmation email');
    });

    it('includes invoice number and receipt URL in HTML when provided', async () => {
      await FinancialEmailService.sendPaymentConfirmation({
        ...params,
        invoiceNumber: 'INV-999',
        receiptUrl: 'https://receipts.example.com/r1',
      });
      const html: string = mocks.mockSendResendEmail.mock.calls[0][0].html;
      expect(html).toContain('INV-999');
      expect(html).toContain('https://receipts.example.com/r1');
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
      expect(mocks.mockSendResendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'member@test.com',
          subject: expect.stringContaining('Payment Failed'),
        }),
        expect.anything(),
      );
    });

    it('throws on send failure', async () => {
      mocks.mockSendResendEmail.mockRejectedValue(new Error('API error'));
      await expect(FinancialEmailService.sendPaymentFailure(params)).rejects.toThrow('API error');
    });

    it('throws when provider returns a failure object', async () => {
      mocks.mockSendResendEmail.mockResolvedValue({ success: false, error: 'Provider rejected message' });
      await expect(FinancialEmailService.sendPaymentFailure(params)).rejects.toThrow('Provider rejected message');
    });

    it('uses fallback message when provider returns no error string', async () => {
      mocks.mockSendResendEmail.mockResolvedValue({ success: false });
      await expect(FinancialEmailService.sendPaymentFailure(params)).rejects.toThrow('Failed to send payment failure email');
    });

    it('includes retry URL in HTML when provided', async () => {
      await FinancialEmailService.sendPaymentFailure({
        ...params,
        retryUrl: 'https://pay.example.com/retry',
      });
      const html: string = mocks.mockSendResendEmail.mock.calls[0][0].html;
      expect(html).toContain('https://pay.example.com/retry');
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
      expect(mocks.mockSendResendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({ filename: 'invoice-INV-2026-001.pdf' }),
          ]),
        }),
        expect.anything(),
      );
    });

    it('sends without attachment when no PDF url', async () => {
      const noAttach = { ...params, invoicePdfUrl: '' };
      await FinancialEmailService.sendInvoice(noAttach);
      expect(mocks.mockSendResendEmail).toHaveBeenCalled();
    });

    it('throws when provider returns a failure object', async () => {
      mocks.mockSendResendEmail.mockResolvedValue({ success: false, error: 'Invoice send failed' });
      await expect(FinancialEmailService.sendInvoice(params)).rejects.toThrow('Invoice send failed');
    });

    it('uses fallback message when provider returns no error string', async () => {
      mocks.mockSendResendEmail.mockResolvedValue({ success: false });
      await expect(FinancialEmailService.sendInvoice(params)).rejects.toThrow('Failed to send invoice email');
    });

    it('includes Pay Now button in HTML when paymentUrl provided', async () => {
      await FinancialEmailService.sendInvoice({
        ...params,
        paymentUrl: 'https://pay.example.com/inv-001',
      });
      const html: string = mocks.mockSendResendEmail.mock.calls[0][0].html;
      expect(html).toContain('https://pay.example.com/inv-001');
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
      expect(mocks.mockSendResendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'Receipt #REC-001' }),
        expect.anything(),
      );
    });

    it('throws when provider returns a failure object', async () => {
      mocks.mockSendResendEmail.mockResolvedValue({ success: false, error: 'Receipt send failed' });
      await expect(FinancialEmailService.sendReceipt({
        to: 'member@test.com',
        memberName: 'Test User',
        receiptNumber: 'REC-001',
        amount: new Decimal('99.99'),
        currency: 'CAD',
        paymentDate: new Date('2026-03-01'),
      })).rejects.toThrow('Receipt send failed');
    });

    it('uses fallback message when provider returns no error string', async () => {
      mocks.mockSendResendEmail.mockResolvedValue({ success: false });
      await expect(FinancialEmailService.sendReceipt({
        to: 'member@test.com',
        memberName: 'Test User',
        receiptNumber: 'REC-001',
        amount: new Decimal('99.99'),
        currency: 'CAD',
        paymentDate: new Date('2026-03-01'),
      })).rejects.toThrow('Failed to send receipt email');
    });

    it('attaches PDF when receiptPdfUrl is provided', async () => {
      await FinancialEmailService.sendReceipt({
        to: 'member@test.com',
        memberName: 'Test User',
        receiptNumber: 'REC-002',
        amount: new Decimal('50.00'),
        currency: 'CAD',
        paymentDate: new Date('2026-03-01'),
        receiptPdfUrl: 'https://storage.example.com/rec.pdf',
      });
      expect(mocks.mockSendResendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: expect.arrayContaining([expect.objectContaining({ filename: 'receipt-REC-002.pdf' })]),
        }),
        expect.anything(),
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
      expect(mocks.mockSendResendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('Overdue'),
        }),
        expect.anything(),
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
      expect(mocks.mockSendResendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('Reminder'),
        }),
        expect.anything(),
      );
    });

    it('throws when provider returns a failure object', async () => {
      mocks.mockSendResendEmail.mockResolvedValue({ success: false, error: 'Reminder send failed' });
      await expect(FinancialEmailService.sendPaymentReminder({
        to: 'member@test.com',
        memberName: 'Late Payer',
        dueAmount: new Decimal('200.00'),
        currency: 'CAD',
        dueDate: new Date('2026-02-01'),
        daysOverdue: 15,
        paymentUrl: 'https://pay.example.com/pay',
      })).rejects.toThrow('Reminder send failed');
    });

    it('uses fallback message when provider returns no error string', async () => {
      mocks.mockSendResendEmail.mockResolvedValue({ success: false });
      await expect(FinancialEmailService.sendPaymentReminder({
        to: 'member@test.com',
        memberName: 'Late Payer',
        dueAmount: new Decimal('200.00'),
        currency: 'CAD',
        dueDate: new Date('2026-02-01'),
        daysOverdue: 15,
        paymentUrl: 'https://pay.example.com/pay',
      })).rejects.toThrow('Failed to send payment reminder email');
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
      expect(mocks.mockSendResendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('AutoPay'),
        }),
        expect.anything(),
      );
    });

    it('throws when provider returns a failure object', async () => {
      mocks.mockSendResendEmail.mockResolvedValue({ success: false, error: 'AutoPay confirmation failed' });
      await expect(FinancialEmailService.sendAutopayConfirmation({
        to: 'member@test.com',
        memberName: 'Auto Payer',
        frequency: 'monthly',
        amount: new Decimal('50.00'),
        currency: 'CAD',
        nextChargeDate: new Date('2026-04-01'),
      })).rejects.toThrow('AutoPay confirmation failed');
    });

    it('uses fallback message when provider returns no error string', async () => {
      mocks.mockSendResendEmail.mockResolvedValue({ success: false });
      await expect(FinancialEmailService.sendAutopayConfirmation({
        to: 'member@test.com',
        memberName: 'Auto Payer',
        frequency: 'monthly',
        amount: new Decimal('50.00'),
        currency: 'CAD',
        nextChargeDate: new Date('2026-04-01'),
      })).rejects.toThrow('Failed to send autopay confirmation email');
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
      expect(mocks.mockSendResendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('AutoPay Disabled'),
        }),
        expect.anything(),
      );
    });

    it('throws when provider returns a failure object', async () => {
      mocks.mockSendResendEmail.mockResolvedValue({ success: false, error: 'AutoPay disabled failed' });
      await expect(FinancialEmailService.sendAutopayDisabled({
        to: 'member@test.com',
        memberName: 'Failed Payer',
        failureCount: 3,
        lastFailureReason: 'Card expired',
        updatePaymentUrl: 'https://pay.example.com/update',
      })).rejects.toThrow('AutoPay disabled failed');
    });

    it('uses fallback message when provider returns no error string', async () => {
      mocks.mockSendResendEmail.mockResolvedValue({ success: false });
      await expect(FinancialEmailService.sendAutopayDisabled({
        to: 'member@test.com',
        memberName: 'Failed Payer',
        failureCount: 3,
        lastFailureReason: 'Card expired',
        updatePaymentUrl: 'https://pay.example.com/update',
      })).rejects.toThrow('Failed to send autopay disabled email');
    });
  });
});
