/**
 * @nzila/zonga-payments — Vodacom M-Pesa Tests
 *
 * Tests for the RSA auth client, adapter lifecycle, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateBearerToken } from '../adapters/vodacom-mpesa.client'
import {
  VodacomMpesaError,
  MpesaResponseCode,
  isRetryableCode,
} from '../adapters/vodacom-mpesa.types'
import type { VodacomMpesaConfig } from '../adapters/vodacom-mpesa.types'
import type { CreateIntentParams, PayoutInstruction, PaymentMethod } from '../types'
import { PaymentProvider, PaymentIntentStatus, PayoutStatus } from '../types'

// ── Test RSA key pair (2048-bit, generated for tests only) ──────────────────

const TEST_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0Z3VS5JJcds3xfn/ygWe
hLhASz3vbMBdNxDMxwIBZT14SBFUf7ISexLGDEsp0Xmu9hGRtcqiwvGFsE2dRMqI
DthMxR7E+bjBB1kPGoD3LPx8joJ/sLnKEk28OBEcRIRkOBE8i5j6+XhCJdE7a/I7
oxCEpFJPSqiOea0lRFl4jfvKTbERTaO9g9bL0ksafQs+m5w7BXhAA/YPH5B9MkYu
hMRMAkUxf+hPHoJ1iICMvdsE1GtPEQuYAOmTSjHeajY6ONhQFrUOQVNP3HMHX5GG
n/pQEd5CfWkRaFHR7GxmJuDc7lRBN1rkybhXg9FGwjvT3X+sJpIQzJ9eGfGj3lfZ
ewIDAQAB
-----END PUBLIC KEY-----`

const TEST_API_KEY = 'test_api_key_12345'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<VodacomMpesaConfig> = {}): VodacomMpesaConfig {
  return {
    baseUrl: 'https://openapi.m-pesa.com/sandbox',
    apiKey: TEST_API_KEY,
    publicKey: TEST_PUBLIC_KEY,
    serviceProviderCode: '000000',
    market: 'TZ',
    callbackUrl: 'https://example.com/api/webhooks/mpesa',
    ...overrides,
  }
}

function makeIntentParams(overrides: Partial<CreateIntentParams> = {}): CreateIntentParams {
  return {
    orderId: 'order_001',
    userId: 'user_001',
    amount: 5000,
    currency: 'TZS',
    method: 'mobile_money' as PaymentMethod,
    idempotencyKey: `conv_${Date.now()}`,
    metadata: { phoneNumber: '255712345678' },
    ...overrides,
  }
}

function makePayoutInstruction(): PayoutInstruction {
  return {
    id: 'payout_001',
    recipientId: 'creator_001',
    amount: 10000,
    currency: 'TZS',
    method: 'mobile_money' as PaymentMethod,
    provider: PaymentProvider.VODACOM_MPESA,
    destination: {
      type: 'mobile_wallet',
      accountIdentifier: '255712345678',
      accountName: 'Test Creator',
      mobileNumber: '255712345678',
    },
    status: PayoutStatus.PENDING,
    providerPayoutId: null,
    batchId: null,
    scheduledAt: new Date(),
    completedAt: null,
  }
}

// ── Bearer Token Generation ─────────────────────────────────────────────────

describe('generateBearerToken', () => {
  it('generates a non-empty base64 token', () => {
    const token = generateBearerToken(TEST_API_KEY, TEST_PUBLIC_KEY)
    expect(token).toBeTruthy()
    expect(typeof token).toBe('string')
    // Should be valid base64
    expect(() => Buffer.from(token, 'base64')).not.toThrow()
  })

  it('generates different tokens for different API keys', () => {
    const token1 = generateBearerToken('key_one', TEST_PUBLIC_KEY)
    const token2 = generateBearerToken('key_two', TEST_PUBLIC_KEY)
    expect(token1).not.toBe(token2)
  })

  it('wraps raw key material in PEM headers', () => {
    // Extract just the base64 content (no PEM headers)
    const rawKey = TEST_PUBLIC_KEY
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\n/g, '')

    const token = generateBearerToken(TEST_API_KEY, rawKey)
    expect(token).toBeTruthy()
  })

  it('throws on invalid public key', () => {
    expect(() => generateBearerToken(TEST_API_KEY, 'not-a-key')).toThrow()
  })
})

// ── Response Code Helpers ───────────────────────────────────────────────────

describe('isRetryableCode', () => {
  it('marks timeout as retryable', () => {
    expect(isRetryableCode(MpesaResponseCode.TIMEOUT)).toBe(true)
  })

  it('marks service unavailable as retryable', () => {
    expect(isRetryableCode(MpesaResponseCode.SERVICE_UNAVAILABLE)).toBe(true)
  })

  it('marks throttled as retryable', () => {
    expect(isRetryableCode(MpesaResponseCode.REQUEST_THROTTLED)).toBe(true)
  })

  it('marks internal error as retryable', () => {
    expect(isRetryableCode(MpesaResponseCode.INTERNAL_ERROR)).toBe(true)
  })

  it('does not mark success as retryable', () => {
    expect(isRetryableCode(MpesaResponseCode.SUCCESS)).toBe(false)
  })

  it('does not mark insufficient balance as retryable', () => {
    expect(isRetryableCode(MpesaResponseCode.INSUFFICIENT_BALANCE)).toBe(false)
  })

  it('does not mark invalid MSISDN as retryable', () => {
    expect(isRetryableCode(MpesaResponseCode.INVALID_MSISDN)).toBe(false)
  })
})

// ── VodacomMpesaError ───────────────────────────────────────────────────────

describe('VodacomMpesaError', () => {
  it('carries response code and description', () => {
    const err = new VodacomMpesaError(
      'Payment failed',
      MpesaResponseCode.INSUFFICIENT_BALANCE,
      'Insufficient balance in wallet',
      'conv_123',
    )

    expect(err.message).toBe('Payment failed')
    expect(err.responseCode).toBe('INS-5')
    expect(err.responseDesc).toBe('Insufficient balance in wallet')
    expect(err.conversationId).toBe('conv_123')
    expect(err.isRetryable).toBe(false)
    expect(err.name).toBe('VodacomMpesaError')
  })

  it('marks retryable errors correctly', () => {
    const err = new VodacomMpesaError(
      'Timeout',
      MpesaResponseCode.TIMEOUT,
      'Request timed out',
      undefined,
      true,
    )

    expect(err.isRetryable).toBe(true)
  })
})

// ── Adapter (with mocked HTTP client) ───────────────────────────────────────

// We mock the client module to avoid real HTTP calls
vi.mock('../adapters/vodacom-mpesa.client', async (importActual) => {
  const actual = await importActual<typeof import('../adapters/vodacom-mpesa.client')>()
  return {
    ...actual,
    createVodacomMpesaClient: vi.fn(),
  }
})

import { createVodacomMpesaClient } from '../adapters/vodacom-mpesa.client'
import { createVodacomMpesaAdapter } from '../adapters/vodacom-mpesa.adapter'

const mockedCreateClient = vi.mocked(createVodacomMpesaClient)

describe('createVodacomMpesaAdapter', () => {
  const mockClient = {
    c2bPayment: vi.fn(),
    queryTransactionStatus: vi.fn(),
    reverseTransaction: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockedCreateClient.mockReturnValue(mockClient)
  })

  it('has provider set to VODACOM_MPESA', () => {
    const adapter = createVodacomMpesaAdapter(makeConfig())
    expect(adapter.provider).toBe(PaymentProvider.VODACOM_MPESA)
  })

  // ── createIntent ────────────────────────────────────────────────────────

  describe('createIntent', () => {
    it('initiates a C2B payment and returns a payment intent', async () => {
      mockClient.c2bPayment.mockResolvedValueOnce({
        output_ResponseCode: 'INS-0',
        output_ResponseDesc: 'Request processed successfully',
        output_TransactionID: 'txn_abc123',
        output_ConversationID: 'conv_abc123',
        output_ThirdPartyConversationID: 'tp_conv_001',
      })

      const adapter = createVodacomMpesaAdapter(makeConfig())
      const params = makeIntentParams()
      const intent = await adapter.createIntent(params)

      expect(intent.provider).toBe(PaymentProvider.VODACOM_MPESA)
      expect(intent.status).toBe(PaymentIntentStatus.PROCESSING)
      expect(intent.providerIntentId).toBe('txn_abc123')
      expect(intent.amount).toBe(5000)
      expect(intent.currency).toBe('TZS')
      expect(intent.metadata).toMatchObject({
        phoneNumber: '255712345678',
        transactionId: 'txn_abc123',
        conversationId: 'conv_abc123',
        market: 'TZ',
      })

      expect(mockClient.c2bPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          input_CustomerMSISDN: '255712345678',
          input_Amount: '5000',
          input_ServiceProviderCode: '000000',
        }),
      )
    })

    it('throws when phoneNumber is missing from metadata', async () => {
      const adapter = createVodacomMpesaAdapter(makeConfig())
      const params = makeIntentParams({ metadata: {} })

      await expect(adapter.createIntent(params)).rejects.toThrow(VodacomMpesaError)
      await expect(adapter.createIntent(params)).rejects.toThrow('Phone number is required')
    })
  })

  // ── captureIntent ───────────────────────────────────────────────────────

  describe('captureIntent', () => {
    it('confirms a completed transaction', async () => {
      mockClient.queryTransactionStatus.mockResolvedValueOnce({
        output_ResponseCode: 'INS-0',
        output_ResponseDesc: 'Success',
        output_ResponseTransactionStatus: 'Completed',
        output_ConversationID: 'conv_abc123',
        output_ThirdPartyConversationID: 'tp_conv_001',
      })

      const adapter = createVodacomMpesaAdapter(makeConfig())
      const capture = await adapter.captureIntent('txn_abc123')

      expect(capture.intentId).toBe('txn_abc123')
      expect(capture.providerTransactionId).toBe('conv_abc123')
      expect(capture.capturedAt).toBeInstanceOf(Date)
    })

    it('throws when transaction is not completed', async () => {
      mockClient.queryTransactionStatus.mockResolvedValueOnce({
        output_ResponseCode: 'INS-6',
        output_ResponseDesc: 'Transaction failed',
        output_ResponseTransactionStatus: 'Failed',
        output_ConversationID: 'conv_abc123',
        output_ThirdPartyConversationID: 'tp_conv_001',
      })

      const adapter = createVodacomMpesaAdapter(makeConfig())
      await expect(adapter.captureIntent('txn_abc123')).rejects.toThrow(
        'M-Pesa payment not completed',
      )
    })
  })

  // ── refundIntent ────────────────────────────────────────────────────────

  describe('refundIntent', () => {
    it('initiates a reversal', async () => {
      mockClient.reverseTransaction.mockResolvedValueOnce({
        output_ResponseCode: 'INS-0',
        output_ResponseDesc: 'Request processed successfully',
        output_TransactionID: 'rev_txn_001',
        output_ConversationID: 'conv_rev_001',
        output_ThirdPartyConversationID: 'tp_rev_001',
      })

      const adapter = createVodacomMpesaAdapter(makeConfig())
      const refund = await adapter.refundIntent('txn_abc123', 2500, 'Customer requested')

      expect(refund.intentId).toBe('txn_abc123')
      expect(refund.amount).toBe(2500)
      expect(refund.reason).toBe('Customer requested')
      expect(refund.providerRefundId).toBe('rev_txn_001')
      expect(refund.status).toBe('processing')

      expect(mockClient.reverseTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          input_ReversalAmount: '2500',
          input_TransactionID: 'txn_abc123',
          input_ServiceProviderCode: '000000',
        }),
      )
    })
  })

  // ── createPayout ────────────────────────────────────────────────────────

  describe('createPayout', () => {
    it('throws — payouts are not supported in v1', async () => {
      const adapter = createVodacomMpesaAdapter(makeConfig())
      const instruction = makePayoutInstruction()

      await expect(adapter.createPayout(instruction)).rejects.toThrow(VodacomMpesaError)
      await expect(adapter.createPayout(instruction)).rejects.toThrow(
        'B2C payouts are not supported',
      )
    })
  })

  // ── verifyWebhook ──────────────────────────────────────────────────────

  describe('verifyWebhook', () => {
    it('accepts valid callback payload with conversation ID', () => {
      const adapter = createVodacomMpesaAdapter(makeConfig())
      const payload = JSON.stringify({
        output_ThirdPartyConversationID: 'tp_conv_001',
        output_ResponseCode: 'INS-0',
      })

      expect(adapter.verifyWebhook('callback', payload)).toBe(true)
    })

    it('rejects empty signature', () => {
      const adapter = createVodacomMpesaAdapter(makeConfig())
      expect(adapter.verifyWebhook('', '{"output_ThirdPartyConversationID":"x"}')).toBe(false)
    })

    it('rejects empty payload', () => {
      const adapter = createVodacomMpesaAdapter(makeConfig())
      expect(adapter.verifyWebhook('sig', '')).toBe(false)
    })

    it('rejects invalid JSON payload', () => {
      const adapter = createVodacomMpesaAdapter(makeConfig())
      expect(adapter.verifyWebhook('sig', 'not json')).toBe(false)
    })

    it('rejects payload missing conversation ID', () => {
      const adapter = createVodacomMpesaAdapter(makeConfig())
      expect(adapter.verifyWebhook('sig', '{"output_ResponseCode":"INS-0"}')).toBe(false)
    })
  })
})
