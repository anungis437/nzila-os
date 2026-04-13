/**
 * Tests for MoMo, Airtel, and Orange Money adapters.
 * All follow the same pattern: mock fetch → create adapter → test each method.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMoMoAdapter, type MoMoConfig } from './momo.adapter'
import { createAirtelAdapter, type AirtelConfig } from './airtel.adapter'
import { createOrangeMoneyAdapter, type OrangeMoneyConfig } from './orange.adapter'
import { PaymentProvider, PaymentIntentStatus, PayoutStatus, RefundStatus } from '../types'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Bad Request',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  }
}

function tokenResponse(accessToken = 'test-token', expiresIn = 3600) {
  return jsonResponse({ access_token: accessToken, expires_in: expiresIn })
}

const payoutInstruction = (provider: string) => ({
  id: 'po-1',
  recipientId: 'artist-1',
  amount: 5000,
  currency: 'KES',
  method: 'mobile_money',
  provider,
  destination: {
    type: 'mobile_wallet' as const,
    accountIdentifier: '+254700123456',
    accountName: 'Artist One',
    mobileNumber: '+254700123456',
  },
  status: PayoutStatus.PENDING,
  providerPayoutId: null,
  batchId: null,
  scheduledAt: new Date(),
  completedAt: null,
})

const intentParams = (provider: string) => ({
  orderId: 'ord-1',
  userId: 'user-1',
  amount: 1000,
  currency: 'KES',
  method: 'mobile_money',
  provider,
  idempotencyKey: 'idem-1',
  metadata: { phoneNumber: '+254700123456' },
})

// ── MTN MoMo ──────────────────────────────────────────────────────────────

describe('createMoMoAdapter', () => {
  const momoConfig: MoMoConfig = {
    baseUrl: 'https://sandbox.momodeveloper.mtn.com',
    subscriptionKey: 'sub-key',
    apiUserId: 'api-user',
    apiKey: 'api-key',
    targetEnvironment: 'sandbox',
    callbackUrl: 'https://example.com/callback',
    providerCallbackHost: 'example.com',
  }

  let adapter: ReturnType<typeof createMoMoAdapter>

  beforeEach(() => {
    vi.clearAllMocks()
    adapter = createMoMoAdapter(momoConfig)
  })

  it('exposes MTN_MOMO provider', () => {
    expect(adapter.provider).toBe(PaymentProvider.MTN_MOMO)
  })

  it('createIntent sends Request To Pay', async () => {
    mockFetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce({ ok: true, status: 202, json: () => Promise.resolve({}) })

    const result = await adapter.createIntent(intentParams(PaymentProvider.MTN_MOMO))
    expect(result.status).toBe(PaymentIntentStatus.PROCESSING)
    expect(result.providerIntentId).toBe('idem-1')
  })

  it('captureIntent checks payment status', async () => {
    mockFetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({
        referenceId: 'ref-1',
        status: 'SUCCESSFUL',
        financialTransactionId: 'ft-123',
      }))

    const capture = await adapter.captureIntent('ref-1')
    expect(capture.providerTransactionId).toBe('ft-123')
  })

  it('captureIntent throws for non-successful status', async () => {
    mockFetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({
        referenceId: 'ref-fail',
        status: 'FAILED',
        reason: { code: '500', message: 'Payer declined' },
      }))

    await expect(adapter.captureIntent('ref-fail')).rejects.toThrow('MoMo payment not successful')
  })

  it('refundIntent creates a disbursement', async () => {
    mockFetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce({ ok: true, status: 202, json: () => Promise.resolve({}) })

    const refund = await adapter.refundIntent('ref-1', 500, 'Customer request')
    expect(refund.status).toBe(RefundStatus.PROCESSING)
    expect(refund.intentId).toBe('ref-1')
  })

  it('createPayout sends disbursement', async () => {
    mockFetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce({ ok: true, status: 202, json: () => Promise.resolve({}) })

    const result = await adapter.createPayout(payoutInstruction(PaymentProvider.MTN_MOMO))
    expect(result.status).toBe(PayoutStatus.PROCESSING)
    expect(result.providerPayoutId).toBe('po-1')
  })

  it('verifyWebhook returns true for non-empty signature', () => {
    expect(adapter.verifyWebhook('sig-123', '{}')).toBe(true)
  })

  it('verifyWebhook returns false for empty signature', () => {
    expect(adapter.verifyWebhook('', '{}')).toBe(false)
  })

  it('token is cached on repeat calls', async () => {
    mockFetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce({ ok: true, status: 202, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: true, status: 202, json: () => Promise.resolve({}) })

    await adapter.createIntent(intentParams(PaymentProvider.MTN_MOMO))
    await adapter.createPayout(payoutInstruction(PaymentProvider.MTN_MOMO))
    // Token fetch should only happen once (cached)
    const tokenCalls = mockFetch.mock.calls.filter(
      (c) => String(c[0]).includes('/token'),
    )
    expect(tokenCalls).toHaveLength(1)
  })
})

// ── Airtel Money ──────────────────────────────────────────────────────────

describe('createAirtelAdapter', () => {
  const airtelConfig: AirtelConfig = {
    baseUrl: 'https://openapiuat.airtel.africa',
    clientId: 'client-id',
    clientSecret: 'client-secret',
    country: 'KE',
    currency: 'KES',
    callbackUrl: 'https://example.com/callback',
  }

  let adapter: ReturnType<typeof createAirtelAdapter>

  beforeEach(() => {
    vi.clearAllMocks()
    adapter = createAirtelAdapter(airtelConfig)
  })

  it('exposes AIRTEL_MONEY provider', () => {
    expect(adapter.provider).toBe(PaymentProvider.AIRTEL_MONEY)
  })

  it('createIntent sends payment push', async () => {
    mockFetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({
        data: { transaction: { id: 'txn-airtel-1', status: 'TIP' } },
        status: { code: '200', message: 'OK', result_code: '0', success: true },
      }))

    const result = await adapter.createIntent(intentParams(PaymentProvider.AIRTEL_MONEY))
    expect(result.id).toBe('txn-airtel-1')
    expect(result.status).toBe(PaymentIntentStatus.PROCESSING)
  })

  it('captureIntent checks transaction status', async () => {
    mockFetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({
        data: { transaction: { airtel_money_id: 'am-123', id: 'txn-1', status: 'TS', message: 'OK' } },
        status: { code: '200', message: 'OK', success: true },
      }))

    const capture = await adapter.captureIntent('txn-1')
    expect(capture.providerTransactionId).toBe('am-123')
  })

  it('captureIntent throws for failed transaction', async () => {
    mockFetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({
        data: { transaction: { airtel_money_id: '', id: 'txn-f', status: 'TF', message: 'Declined' } },
        status: { code: '400', message: 'Failed', success: false },
      }))

    await expect(adapter.captureIntent('txn-f')).rejects.toThrow('Airtel payment not successful')
  })

  it('refundIntent creates refund request', async () => {
    mockFetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ data: {}, status: { code: '200', success: true } }))

    const refund = await adapter.refundIntent('txn-1', 200, 'Overcharge')
    expect(refund.status).toBe(RefundStatus.PROCESSING)
  })

  it('createPayout sends disbursement', async () => {
    mockFetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({
        data: { transaction: { reference_id: 'ref-1', airtel_money_id: 'am-po-1', id: 'did-1' } },
        status: { code: '200', success: true },
      }))

    const result = await adapter.createPayout(payoutInstruction(PaymentProvider.AIRTEL_MONEY))
    expect(result.providerPayoutId).toBe('am-po-1')
    expect(result.status).toBe(PayoutStatus.PROCESSING)
  })

  it('verifyWebhook returns true/false based on signature length', () => {
    expect(adapter.verifyWebhook('sig', '{}')).toBe(true)
    expect(adapter.verifyWebhook('', '{}')).toBe(false)
  })
})

// ── Orange Money ──────────────────────────────────────────────────────────

describe('createOrangeMoneyAdapter', () => {
  const orangeConfig: OrangeMoneyConfig = {
    baseUrl: 'https://api.orange.com',
    clientId: 'client-id',
    clientSecret: 'client-secret',
    merchantMsisdn: '+221770000000',
    pin: '1234',
    callbackUrl: 'https://example.com/callback',
    targetCountry: 'SN',
  }

  let adapter: ReturnType<typeof createOrangeMoneyAdapter>

  beforeEach(() => {
    vi.clearAllMocks()
    adapter = createOrangeMoneyAdapter(orangeConfig)
  })

  it('exposes ORANGE_MONEY provider', () => {
    expect(adapter.provider).toBe(PaymentProvider.ORANGE_MONEY)
  })

  it('createIntent sends webpayment request', async () => {
    mockFetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({
        payToken: 'pt-orange-1',
        status: 'INITIATED',
        notifToken: 'ntf-1',
        txnid: 'txn-org-1',
      }))

    const result = await adapter.createIntent(intentParams(PaymentProvider.ORANGE_MONEY))
    expect(result.id).toBe('pt-orange-1')
    expect(result.status).toBe(PaymentIntentStatus.PROCESSING)
    expect(result.metadata?.payToken).toBe('pt-orange-1')
  })

  it('captureIntent checks payment status', async () => {
    mockFetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({
        status: 'SUCCESS',
        txnid: 'txn-org-cap',
        message: 'Payment successful',
      }))

    const capture = await adapter.captureIntent('pt-1')
    expect(capture.providerTransactionId).toBe('txn-org-cap')
  })

  it('captureIntent throws for non-SUCCESS', async () => {
    mockFetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({
        status: 'FAILED',
        txnid: '',
        message: 'Declined',
      }))

    await expect(adapter.captureIntent('pt-fail')).rejects.toThrow('Orange Money payment not successful')
  })

  it('refundIntent returns processing refund', async () => {
    const refund = await adapter.refundIntent('txn-1', 300, 'Customer request')
    expect(refund.status).toBe(RefundStatus.PROCESSING)
    expect(refund.intentId).toBe('txn-1')
  })

  it('createPayout sends cashout', async () => {
    mockFetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({}))

    const result = await adapter.createPayout(payoutInstruction(PaymentProvider.ORANGE_MONEY))
    expect(result.status).toBe(PayoutStatus.PROCESSING)
    expect(result.providerPayoutId).toBe('po-1')
  })

  it('verifyWebhook returns true/false based on signature', () => {
    expect(adapter.verifyWebhook('ntf-token', '{}')).toBe(true)
    expect(adapter.verifyWebhook('', '{}')).toBe(false)
  })
})
