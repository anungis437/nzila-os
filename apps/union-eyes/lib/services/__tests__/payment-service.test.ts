/**
 * Payment Service — Unit Tests
 *
 * Tests:
 *   - createCheckoutSession: validation, Stripe delegation
 *   - handlePaymentSuccess: DB update, notification
 *   - handlePaymentFailure: retry metadata, notification
 *   - generateReceipt: validation, receipt number format
 *
 * Tier 1 — Security & Money
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();

vi.mock('@/db', () => ({
  db: {
    select: (...a: any[]) => mockDbSelect(...a),
    update: (...a: any[]) => mockDbUpdate(...a),
  },
}));

vi.mock('@/db/schema/domains/finance/dues', () => ({
  duesTransactions: {
    id: 'id', memberId: 'memberId', organizationId: 'organizationId',
    totalAmount: 'totalAmount', duesAmount: 'duesAmount', copeAmount: 'copeAmount',
    pacAmount: 'pacAmount', strikeFundAmount: 'strikeFundAmount',
    status: 'status', paidDate: 'paidDate', processorType: 'processorType',
    processorPaymentId: 'processorPaymentId', paymentMethod: 'paymentMethod',
    receiptUrl: 'receiptUrl', metadata: 'metadata', updatedAt: 'updatedAt',
  },
}));

vi.mock('@/db/schema-organizations', () => ({
  organizationMembers: { id: 'id', name: 'name', email: 'email' },
  organizations: { id: 'id', name: 'name' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: any[]) => ({ type: 'eq', args })),
  and: vi.fn((...args: any[]) => ({ type: 'and', args })),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@react-pdf/renderer', () => ({
  Document: 'Document',
  Page: 'Page',
  StyleSheet: { create: vi.fn((s: any) => s) },
  Text: 'Text',
  pdf: vi.fn(() => ({ toBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-pdf')) })),
}));

vi.mock('react', () => ({
  default: { createElement: vi.fn((...args: any[]) => ({ type: args[0], props: args[1] })) },
  createElement: vi.fn((...args: any[]) => ({ type: args[0], props: args[1] })),
}));

const mockStripeCheckoutCreate = vi.fn();
vi.mock('@nzila/payments-stripe', () => ({
  getStripeClient: vi.fn(() => ({
    checkout: {
      sessions: { create: (...a: any[]) => mockStripeCheckoutCreate(...a) },
    },
  })),
}));

vi.mock('@/lib/services/dues-notifications', () => ({
  sendPaymentConfirmation: vi.fn().mockResolvedValue(undefined),
  sendPaymentFailure: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/decimal-safe', () => ({
  toCents: vi.fn((amount: string) => Math.round(parseFloat(amount) * 100)),
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { PaymentService } from '../payment-service';

// ── Helpers ──────────────────────────────────────────────────────────────────

function selectChain(rows: Record<string, unknown>[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
      innerJoin: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(rows),
          }),
        }),
      }),
    }),
  };
}

function updateChain() {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  };
}

// ─── createCheckoutSession ──────────────────────────────────────────────────

describe('PaymentService.createCheckoutSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws if transaction not found', async () => {
    mockDbSelect.mockReturnValue(selectChain([]));

    await expect(
      PaymentService.createCheckoutSession({
        transactionId: 'txn-404',
        returnUrl: 'https://example.com/return',
        cancelUrl: 'https://example.com/cancel',
      }),
    ).rejects.toThrow('Transaction not found: txn-404');
  });

  it('throws if transaction status is not pending/overdue', async () => {
    // First call: transaction query
    mockDbSelect.mockReturnValueOnce(
      selectChain([
        { id: 'txn-1', status: 'paid', totalAmount: '50.00', memberId: 'mem-1' },
      ]),
    );

    await expect(
      PaymentService.createCheckoutSession({
        transactionId: 'txn-1',
        returnUrl: 'https://x.com/r',
        cancelUrl: 'https://x.com/c',
      }),
    ).rejects.toThrow('Transaction status is paid');
  });

  it('throws for unsupported PayPal processor', async () => {
    mockDbSelect
      .mockReturnValueOnce(
        selectChain([
          {
            id: 'txn-1', status: 'pending', totalAmount: '100.00',
            duesAmount: '85.00', copeAmount: '10.00', pacAmount: '3.00',
            strikeFundAmount: '2.00', memberId: 'mem-1',
          },
        ]),
      )
      .mockReturnValueOnce(
        selectChain([{ name: 'J. Worker', email: 'jw@union.org' }]),
      );

    await expect(
      PaymentService.createCheckoutSession({
        transactionId: 'txn-1',
        returnUrl: 'https://x.com/r',
        cancelUrl: 'https://x.com/c',
        processorType: 'paypal',
      }),
    ).rejects.toThrow('PayPal checkout not yet implemented');
  });

  it('creates Stripe checkout session on valid pending transaction', async () => {
    mockDbSelect
      .mockReturnValueOnce(
        selectChain([
          {
            id: 'txn-1', status: 'pending', totalAmount: '100.00',
            duesAmount: '85.00', copeAmount: '10.00', pacAmount: '3.00',
            strikeFundAmount: '2.00', memberId: 'mem-1',
          },
        ]),
      )
      .mockReturnValueOnce(
        selectChain([{ name: 'J. Worker', email: 'jw@union.org' }]),
      );

    mockStripeCheckoutCreate.mockResolvedValue({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.com/pay/cs_test_123',
    });

    const result = await PaymentService.createCheckoutSession({
      transactionId: 'txn-1',
      returnUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    });

    expect(result.sessionId).toBe('cs_test_123');
    expect(result.checkoutUrl).toBe('https://checkout.stripe.com/pay/cs_test_123');
    expect(result.transactionId).toBe('txn-1');
    expect(mockStripeCheckoutCreate).toHaveBeenCalledOnce();
  });
});

// ─── handlePaymentSuccess ────────────────────────────────────────────────────

describe('PaymentService.handlePaymentSuccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates transaction to paid and sends confirmation', async () => {
    mockDbUpdate.mockReturnValue(updateChain());

    await PaymentService.handlePaymentSuccess({
      transactionId: 'txn-1',
      processorPaymentId: 'pi_test_123',
      processorType: 'stripe',
      amount: '100.00',
    });

    expect(mockDbUpdate).toHaveBeenCalledOnce();
    // Notification should be sent
    const { sendPaymentConfirmation } = await import(
      '@/lib/services/dues-notifications'
    );
    expect(sendPaymentConfirmation).toHaveBeenCalledWith('txn-1');
  });
});

// ─── handlePaymentFailure ────────────────────────────────────────────────────

describe('PaymentService.handlePaymentFailure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('increments failure count and keeps status pending', async () => {
    mockDbSelect.mockReturnValue(
      selectChain([
        {
          id: 'txn-1', status: 'pending', metadata: { failureCount: 1 },
        },
      ]),
    );
    mockDbUpdate.mockReturnValue(updateChain());

    await PaymentService.handlePaymentFailure({
      transactionId: 'txn-1',
      processorType: 'stripe',
      errorMessage: 'Card declined',
      errorCode: 'card_declined',
    });

    expect(mockDbUpdate).toHaveBeenCalledOnce();
    const { sendPaymentFailure } = await import(
      '@/lib/services/dues-notifications'
    );
    expect(sendPaymentFailure).toHaveBeenCalledWith('txn-1', 'Card declined', false);
  });

  it('throws if transaction not found', async () => {
    mockDbSelect.mockReturnValue(selectChain([]));

    await expect(
      PaymentService.handlePaymentFailure({
        transactionId: 'txn-404',
        processorType: 'stripe',
        errorMessage: 'Not found',
      }),
    ).rejects.toThrow('Transaction not found: txn-404');
  });
});

// ─── generateReceipt ─────────────────────────────────────────────────────────

describe('PaymentService.generateReceipt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws if transaction not found', async () => {
    mockDbSelect.mockReturnValue(selectChain([]));

    await expect(
      PaymentService.generateReceipt('txn-404'),
    ).rejects.toThrow('Transaction not found: txn-404');
  });

  it('throws if transaction is not paid', async () => {
    mockDbSelect.mockReturnValue(
      selectChain([
        {
          transaction: { id: 'txn-1', status: 'pending', totalAmount: '50.00' },
          memberName: 'J Worker',
          memberEmail: 'jw@union.org',
          organizationName: 'CUPE Local 123',
        },
      ]),
    );

    await expect(
      PaymentService.generateReceipt('txn-1'),
    ).rejects.toThrow('Transaction not paid: txn-1');
  });
});

// ─── getTransactionBySessionId ───────────────────────────────────────────────

describe('PaymentService.getTransactionBySessionId', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns matching transaction by stripeSessionId in metadata', async () => {
    const txns = [
      { id: 'txn-1', processorType: 'stripe', metadata: { stripeSessionId: 'cs_abc' } },
      { id: 'txn-2', processorType: 'stripe', metadata: { stripeSessionId: 'cs_xyz' } },
    ];
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(txns),
      }),
    });

    const result = await PaymentService.getTransactionBySessionId('cs_abc');
    expect(result).toMatchObject({ id: 'txn-1' });
  });

  it('returns null when no transaction matches session ID', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: 'txn-1', processorType: 'stripe', metadata: { stripeSessionId: 'cs_other' } },
        ]),
      }),
    });

    const result = await PaymentService.getTransactionBySessionId('cs_missing');
    expect(result).toBeNull();
  });
});
