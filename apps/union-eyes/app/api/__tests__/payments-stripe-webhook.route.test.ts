import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createHmac } from 'node:crypto';

const TEST_ORG_ID = '00000000-0000-0000-0000-000000000001';

const m = vi.hoisted(() => {
  const state = {
    selectQueue: [] as unknown[][],
    insertResults: [] as unknown[][],
    updateResults: [] as unknown[][],
  };

  const nextSelect = () => Promise.resolve((state.selectQueue.shift() ?? []) as unknown[]);
  const nextInsert = () => Promise.resolve((state.insertResults.shift() ?? []) as unknown[]);
  const nextUpdate = () => Promise.resolve((state.updateResults.shift() ?? []) as unknown[]);

  const createSelectChain = () => {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      then: (resolve: (value: unknown[]) => unknown) => nextSelect().then(resolve),
    };
    return chain;
  };

  const createInsertChain = () => {
    const chain = {
      values: vi.fn(() => chain),
      onConflictDoNothing: vi.fn(() => chain),
      returning: vi.fn(() => nextInsert()),
      then: (resolve: (value: unknown[]) => unknown) => nextInsert().then(resolve),
    };
    return chain;
  };

  const createUpdateChain = () => {
    const chain = {
      set: vi.fn(() => chain),
      where: vi.fn(() => chain),
      returning: vi.fn(() => nextUpdate()),
      then: (resolve: (value: unknown[]) => unknown) => nextUpdate().then(resolve),
    };
    return chain;
  };

  const withSystemContext = vi.fn(async (fn: (db: unknown) => Promise<unknown>) => {
    const snapshot = {
      selectQueue: [...state.selectQueue],
      insertResults: [...state.insertResults],
      updateResults: [...state.updateResults],
    };

    try {
      return await fn(mockDb);
    } catch (error) {
      state.selectQueue = snapshot.selectQueue;
      state.insertResults = snapshot.insertResults;
      state.updateResults = snapshot.updateResults;
      throw error;
    }
  });

  return {
    state,
    queueSelect: (...results: unknown[][]) => state.selectQueue.push(...results),
    queueInsert: (...results: unknown[][]) => state.insertResults.push(...results),
    queueUpdate: (...results: unknown[][]) => state.updateResults.push(...results),
    resetQueues: () => {
      state.selectQueue = [];
      state.insertResults = [];
      state.updateResults = [];
    },
    createSelectChain,
    createInsertChain,
    createUpdateChain,
    withSystemContext,
    evaluateFee: vi.fn(),
    captureTransactionFee: vi.fn(),
    reverseTransactionFee: vi.fn(),
    reconcileExternalInvoicePayment: vi.fn(),
    auditLog: vi.fn(),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    syncIcraPurchase: vi.fn(),
    syncWorkbookPurchase: vi.fn(),
    generateClaimToken: vi.fn(),
    computeClaimExpiry: vi.fn(),
  };
});

const mockDb = {
  select: vi.fn(() => m.createSelectChain()),
  insert: vi.fn(() => m.createInsertChain()),
  update: vi.fn(() => m.createUpdateChain()),
};

vi.mock('@/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: m.withSystemContext,
}));
vi.mock('@/services/platform-economics', () => ({
  evaluateFee: m.evaluateFee,
  captureTransactionFee: m.captureTransactionFee,
  reverseTransactionFee: m.reverseTransactionFee,
  reconcileExternalInvoicePayment: m.reconcileExternalInvoicePayment,
}));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/audit-logger', () => ({
  auditLog: m.auditLog,
  AuditEventType: { API_WEBHOOK_RECEIVED: 'api.webhook.received' },
  AuditSeverity: { LOW: 'low' },
}));
vi.mock('@/lib/hubspot/syncIcraPurchase', () => ({ syncIcraPurchase: m.syncIcraPurchase }));
vi.mock('@/lib/hubspot/syncWorkbookPurchase', () => ({ syncWorkbookPurchase: m.syncWorkbookPurchase }));
vi.mock('@/lib/icra/claim-tokens', () => ({
  generateClaimToken: m.generateClaimToken,
  computeClaimExpiry: m.computeClaimExpiry,
}));

function makeStripeRequest(payload: string, secret: string, signature = true) {
  // Fresh timestamp so the webhook's signature-freshness window is satisfied.
  const timestamp = String(Math.floor(Date.now() / 1000));
  const hash = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return new NextRequest('http://localhost/api/payments/webhooks/stripe', {
    method: 'POST',
    body: payload,
    headers: signature
      ? {
          'content-type': 'application/json',
          'stripe-signature': `t=${timestamp},v1=${hash}`,
        }
      : { 'content-type': 'application/json' },
  });
}

async function loadRoute(secret?: string) {
  vi.resetModules();
  if (secret === undefined) {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  } else {
    process.env.STRIPE_WEBHOOK_SECRET = secret;
  }
  return import('../payments/webhooks/stripe/route');
}

describe('payments/webhooks/stripe route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.resetQueues();
    m.evaluateFee.mockResolvedValue({
      ruleId: 'rule-1',
      grossAmountCad: '10',
      feeAmountCad: '1',
      netAmountCad: '9',
      feeModel: 'flat',
      percentageRateApplied: null,
      flatFeeApplied: '1',
    });
    m.generateClaimToken.mockReturnValue('claim-token-123');
    m.computeClaimExpiry.mockReturnValue(new Date('2026-06-30T00:00:00.000Z'));
    m.auditLog.mockResolvedValue(undefined);
    m.reverseTransactionFee.mockResolvedValue(undefined);
    m.captureTransactionFee.mockResolvedValue(undefined);
  });

  it('rejects requests without a stripe signature header', async () => {
    const { POST } = await loadRoute('whsec_test');
    const response = await POST(makeStripeRequest(JSON.stringify({ id: 'evt_1' }), 'whsec_test', false));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'Missing stripe-signature header' });
  }, 60000);

  it('rejects requests with an invalid signature', async () => {
    const { POST } = await loadRoute('whsec_test');
    const response = await POST(new NextRequest('http://localhost/api/payments/webhooks/stripe', {
      method: 'POST',
      body: JSON.stringify({ id: 'evt_1', type: 'payment_intent.succeeded', data: { object: {} } }),
      headers: {
        'content-type': 'application/json',
        'stripe-signature': `t=1700000000,v1=${'0'.repeat(64)}`,
      },
    }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: 'Invalid signature' });
  });

  it('rejects malformed signatures without throwing', async () => {
    const { POST } = await loadRoute('whsec_test');
    const response = await POST(new NextRequest('http://localhost/api/payments/webhooks/stripe', {
      method: 'POST',
      body: JSON.stringify({ id: 'evt_1', type: 'payment_intent.succeeded', data: { object: {} } }),
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 't=1700000000,v1=short',
      },
    }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: 'Invalid signature' });
  });

  it('rejects requests when the webhook secret is missing', async () => {
    const { POST } = await loadRoute('');
    const payload = JSON.stringify({ id: 'evt_1', type: 'payment_intent.succeeded', data: { object: {} } });
    const response = await POST(makeStripeRequest(payload, 'fallback-secret'));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: 'Webhook secret not configured' });
  });

  it('treats a replayed platform payment as an idempotent duplicate', async () => {
    const { POST } = await loadRoute('whsec_test');
    // resolveBillingAccountId -> billing; reservation conflicts (empty insert)
    // -> load the owning payment -> ownership matches -> duplicate.
    m.queueSelect(
      [{ id: 'billing-1' }],
      [{ id: 'existing-payment', method: 'stripe', amount: '10.00', currency: 'CAD' }],
    );
    m.queueInsert([]);
    const payload = JSON.stringify({
      id: 'evt_duplicate',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_dup',
          amount: 1000,
          currency: 'cad',
          metadata: { organization_id: TEST_ORG_ID },
        },
      },
    });

    const response = await POST(makeStripeRequest(payload, 'whsec_test'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ received: true, status: 'duplicate' });
    expect(m.captureTransactionFee).not.toHaveBeenCalled();
  });

  it('rejects a reference conflict whose persisted payment does not match (collision)', async () => {
    const { POST } = await loadRoute('whsec_test');
    // Reservation conflicts, but the owning payment is a DIFFERENT amount — an
    // identifier collision must not authorize a different payment.
    m.queueSelect(
      [{ id: 'billing-1' }],
      [{ id: 'other-payment', method: 'stripe', amount: '999.00', currency: 'CAD' }],
    );
    m.queueInsert([]);
    const payload = JSON.stringify({
      id: 'evt_collision',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_collision',
          amount: 1000,
          currency: 'cad',
          metadata: { organization_id: TEST_ORG_ID },
        },
      },
    });

    const response = await POST(makeStripeRequest(payload, 'whsec_test'));

    expect(response.status).toBe(500);
    expect(m.captureTransactionFee).not.toHaveBeenCalled();
  });

  it('returns a retryable failure when system database access fails', async () => {
    const { POST } = await loadRoute('whsec_test');
    m.withSystemContext.mockRejectedValueOnce(new Error('database unavailable'));
    const payload = JSON.stringify({
      id: 'evt_retryable_failure',
      type: 'payment_intent.succeeded',
      data: { object: {} },
    });

    const response = await POST(makeStripeRequest(payload, 'whsec_test'));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      received: false,
      error: 'Internal processing error',
    });
  });

  it('acknowledges unrelated signed events without querying the billing ledger', async () => {
    const { POST } = await loadRoute('whsec_test');
    const payload = JSON.stringify({
      id: 'evt_configuration_probe',
      type: 'unioneyes.configuration.probe',
      data: { object: {} },
    });

    const response = await POST(makeStripeRequest(payload, 'whsec_test'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ received: true });
    expect(m.withSystemContext).not.toHaveBeenCalled();
  });

  it('records a successful payment intent and captures the transaction fee', async () => {
    const { POST } = await loadRoute('whsec_test');
    m.queueSelect([{ id: 'billing-1' }]);
    m.queueInsert([{ id: 'payment-1' }]);
    const payload = JSON.stringify({
      id: 'evt_payment_1',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_123',
          amount: 1000,
          currency: 'cad',
          metadata: { organization_id: TEST_ORG_ID },
        },
      },
    });

    const response = await POST(makeStripeRequest(payload, 'whsec_test'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ received: true });
    expect(mockDb.insert).toHaveBeenCalled();
    expect(m.evaluateFee).toHaveBeenCalledWith(expect.objectContaining({ organizationId: TEST_ORG_ID, flowType: 'payment' }));
    expect(m.captureTransactionFee).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: 'fee-evt_payment_1',
      sourceTransactionId: 'pi_123',
    }));
  });

  it('reconciles invoice.paid events and captures invoice fees', async () => {
    const { POST } = await loadRoute('whsec_test');
    m.queueSelect([{ id: 'billing-1' }]);
    const payload = JSON.stringify({
      id: 'evt_invoice_paid_1',
      type: 'invoice.paid',
      data: {
        object: {
          id: 'in_123',
          amount_paid: 2500,
          currency: 'cad',
          metadata: {
            organization_id: TEST_ORG_ID,
            platform_invoice_id: 'platform-invoice-1',
          },
        },
      },
    });

    const response = await POST(makeStripeRequest(payload, 'whsec_test'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ received: true });
    expect(m.reconcileExternalInvoicePayment).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: TEST_ORG_ID,
      invoiceId: 'platform-invoice-1',
      status: 'completed',
    }));
    expect(m.captureTransactionFee).toHaveBeenCalledWith(expect.objectContaining({
      sourceTransactionType: 'stripe_invoice',
      idempotencyKey: 'fee-evt_invoice_paid_1',
    }));
  });

  it('marks invoice.payment_failed as failed reconciliation', async () => {
    const { POST } = await loadRoute('whsec_test');
    const payload = JSON.stringify({
      id: 'evt_invoice_failed_1',
      type: 'invoice.payment_failed',
      data: {
        object: {
          id: 'in_999',
          amount_due: 3200,
          metadata: {
            organization_id: TEST_ORG_ID,
            platform_invoice_id: 'platform-invoice-2',
          },
        },
      },
    });

    const response = await POST(makeStripeRequest(payload, 'whsec_test'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ received: true });
    expect(m.reconcileExternalInvoicePayment).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: TEST_ORG_ID,
      invoiceId: 'platform-invoice-2',
      status: 'failed',
      failureReason: 'stripe_invoice_payment_failed',
    }));
  });

  it('records charge.refunded events and reverses captured fees', async () => {
    const { POST } = await loadRoute('whsec_test');
    m.queueSelect([{ id: 'billing-1' }], [{ id: 'fee-event-1' }]);
    m.queueInsert([{ id: 'refund-payment-1' }]);
    const payload = JSON.stringify({
      id: 'evt_refund_1',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_123',
          payment_intent: 'pi_123',
          amount_refunded: 1400,
          currency: 'cad',
          metadata: {
            organization_id: TEST_ORG_ID,
          },
        },
      },
    });

    const response = await POST(makeStripeRequest(payload, 'whsec_test'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ received: true });
    expect(mockDb.insert).toHaveBeenCalled();
    expect(m.reverseTransactionFee).toHaveBeenCalledWith(
      'fee-event-1',
      'ch_123',
      expect.stringContaining('Stripe refund'),
    );
  });

  it('upgrades workbook purchases and issues a claim token', async () => {
    const { POST } = await loadRoute('whsec_test');
    // Existence guard → fresh reservation wins → guarded update wins.
    m.queueSelect([{ id: 'workbook-1' }]);
    m.queueInsert([{ id: 'purchase-1', workbookId: 'workbook-1' }]);
    m.queueUpdate([{ id: 'workbook-1' }]);
    const payload = JSON.stringify({
      id: 'evt_workbook_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          payment_intent: 'pi_123',
          amount_total: 12500,
          currency: 'cad',
          customer_email: 'buyer@example.com',
          metadata: {
            product: 'workbook',
            workbook_id: 'workbook-1',
            workbook_tier_id: 'workbook_self_guided',
            organization_name: 'Union Eyes',
          },
        },
      },
    });

    const response = await POST(makeStripeRequest(payload, 'whsec_test'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ received: true });
    expect(mockDb.update).toHaveBeenCalled();
    expect(m.syncWorkbookPurchase).toHaveBeenCalledTimes(1);
    expect(m.syncWorkbookPurchase).toHaveBeenCalledWith(expect.objectContaining({
      workbookId: 'workbook-1',
      paymentReference: 'pi_123',
      email: 'buyer@example.com',
    }));
  });

  it('treats an exact replay (same payment, same workbook) as an idempotent no-op', async () => {
    const { POST } = await loadRoute('whsec_test');
    // Existence guard → reservation conflicts → owning purchase is this workbook.
    m.queueSelect([{ id: 'workbook-1' }], [{ workbookId: 'workbook-1' }]);
    m.queueInsert([]);
    const payload = JSON.stringify({
      id: 'evt_workbook_replay',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_workbook_replay',
          payment_intent: 'pi_replay',
          amount_total: 12500,
          currency: 'cad',
          customer_email: 'buyer@example.com',
          metadata: {
            product: 'workbook',
            workbook_id: 'workbook-1',
            workbook_tier_id: 'workbook_self_guided',
          },
        },
      },
    });

    const response = await POST(makeStripeRequest(payload, 'whsec_test'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ received: true });
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(m.generateClaimToken).toHaveBeenCalledTimes(1); // computed, but never persisted
    expect(m.syncWorkbookPurchase).not.toHaveBeenCalled();
  });

  it('rejects a payment reference already owned by another workbook', async () => {
    const { POST } = await loadRoute('whsec_test');
    m.queueSelect(
      [{ reportTierId: 'continuity_reflection', claimToken: null }],
      [{ workbookId: 'workbook-2' }],
    );
    m.queueInsert([]);
    const payload = JSON.stringify({
      id: 'evt_workbook_conflict',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_workbook_conflict',
          payment_intent: 'pi_shared',
          amount_total: 12500,
          currency: 'cad',
          customer_email: 'buyer@example.com',
          metadata: {
            product: 'workbook',
            workbook_id: 'workbook-1',
            workbook_tier_id: 'workbook_self_guided',
          },
        },
      },
    });

    const response = await POST(makeStripeRequest(payload, 'whsec_test'));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      received: false,
      error: 'Workbook fulfillment failed',
    });
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(m.syncWorkbookPurchase).not.toHaveBeenCalled();
    expect(m.state.insertResults).toEqual([[]]);
  });

  it('rejects contention: reservation wins but the guarded workbook update returns zero rows', async () => {
    const { POST } = await loadRoute('whsec_test');
    // Existence guard passes, reservation wins, but the guarded UPDATE finds the
    // workbook already transitioned → zero rows → throw.
    m.queueSelect([{ id: 'workbook-1' }]);
    m.queueInsert([{ id: 'purchase-1', workbookId: 'workbook-1' }]);
    m.queueUpdate([]);
    const payload = JSON.stringify({
      id: 'evt_workbook_contention',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_workbook_contention',
          payment_intent: 'pi_contended',
          amount_total: 12500,
          currency: 'cad',
          customer_email: 'buyer@example.com',
          metadata: {
            product: 'workbook',
            workbook_id: 'workbook-1',
            workbook_tier_id: 'workbook_self_guided',
          },
        },
      },
    });

    const response = await POST(makeStripeRequest(payload, 'whsec_test'));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      received: false,
      error: 'Workbook fulfillment failed',
    });
    expect(m.syncWorkbookPurchase).not.toHaveBeenCalled();
    // Reservation rolled back with the failed transaction.
    expect(m.state.insertResults).toEqual([[{ id: 'purchase-1', workbookId: 'workbook-1' }]]);
  });

  it('returns a retryable failure when workbook persistence throws', async () => {
    const { POST } = await loadRoute('whsec_test');
    m.withSystemContext.mockRejectedValueOnce(new Error('workbook persistence unavailable'));
    const payload = JSON.stringify({
      id: 'evt_workbook_persistence',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_workbook_persistence',
          payment_intent: 'pi_persist',
          amount_total: 12500,
          currency: 'cad',
          customer_email: 'buyer@example.com',
          metadata: {
            product: 'workbook',
            workbook_id: 'workbook-1',
            workbook_tier_id: 'workbook_self_guided',
          },
        },
      },
    });

    const response = await POST(makeStripeRequest(payload, 'whsec_test'));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      received: false,
      error: 'Workbook fulfillment failed',
    });
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(m.syncWorkbookPurchase).not.toHaveBeenCalled();
  });

  it('reserves and succeeds on a retry after a rolled-back attempt', async () => {
    const { POST } = await loadRoute('whsec_test');
    // First attempt: reservation wins, guarded update returns zero → throw →
    // the mock restores the queue snapshot (models the reservation rolling back).
    m.queueSelect([{ id: 'workbook-1' }]);
    m.queueInsert([{ id: 'purchase-1', workbookId: 'workbook-1' }]);
    m.queueUpdate([]);
    const makePayload = (eventId: string) =>
      JSON.stringify({
        id: eventId,
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_workbook_retry',
            payment_intent: 'pi_retry',
            amount_total: 12500,
            currency: 'cad',
            customer_email: 'buyer@example.com',
            metadata: {
              product: 'workbook',
              workbook_id: 'workbook-1',
              workbook_tier_id: 'workbook_self_guided',
            },
          },
        },
      });

    const first = await POST(makeStripeRequest(makePayload('evt_retry_1'), 'whsec_test'));
    expect(first.status).toBe(500);
    // The reservation was rolled back with the failed transaction.
    expect(m.state.insertResults).toEqual([[{ id: 'purchase-1', workbookId: 'workbook-1' }]]);

    // Second identical delivery once the transient contention has cleared: the
    // reservation is available again and the guarded update now wins.
    m.resetQueues();
    m.queueSelect([{ id: 'workbook-1' }]);
    m.queueInsert([{ id: 'purchase-1', workbookId: 'workbook-1' }]);
    m.queueUpdate([{ id: 'workbook-1' }]);
    const second = await POST(makeStripeRequest(makePayload('evt_retry_2'), 'whsec_test'));
    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toMatchObject({ received: true });
    expect(m.syncWorkbookPurchase).toHaveBeenCalledTimes(1);
  });

  it('returns a retryable error when ICRA paid-report fulfillment fails', async () => {
    const { POST } = await loadRoute('whsec_test');
    m.withSystemContext.mockRejectedValueOnce(new Error('transient database failure'));
    const payload = JSON.stringify({
      id: 'evt_icra_failure_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_icra_failure_1',
          metadata: {
            product: 'icra_report',
            icra_assessment_id: '00000000-0000-0000-0000-000000000099',
            icra_tier_id: 'executive_continuity_brief',
          },
        },
      },
    });

    const response = await POST(makeStripeRequest(payload, 'whsec_test'));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      received: false,
      error: 'ICRA fulfillment failed',
    });
  });

  it('returns a retryable failure on internal parsing errors', async () => {
    const { POST } = await loadRoute('whsec_test');
    const response = await POST(makeStripeRequest('not-json', 'whsec_test'));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      received: false,
      error: 'Internal processing error',
    });
  });
});
