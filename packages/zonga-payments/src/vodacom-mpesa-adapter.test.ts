import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createVodacomMpesaAdapter } from './adapters/vodacom-mpesa.adapter'
import { VodacomMpesaError } from './adapters/vodacom-mpesa.types'
import { PaymentProvider, PaymentIntentStatus } from './types'
import type { PayoutInstruction } from './types'

// Mock the client to avoid RSA crypto
const mockC2bPayment = vi.fn()
const mockQueryTransactionStatus = vi.fn()
const mockReverseTransaction = vi.fn()

vi.mock('./adapters/vodacom-mpesa.client', () => ({
  createVodacomMpesaClient: vi.fn(() => ({
    c2bPayment: mockC2bPayment,
    queryTransactionStatus: mockQueryTransactionStatus,
    reverseTransaction: mockReverseTransaction,
  })),
}))

const config = {
  baseUrl: 'https://openapi.m-pesa.com',
  apiKey: 'test-key',
  publicKey: 'test-pk',
  serviceProviderCode: 'SP001',
  market: 'TZ' as const,
}

function makePayoutInstruction(overrides?: Partial<PayoutInstruction>): PayoutInstruction {
  return {
    id: 'payout-1',
    recipientId: 'recipient-1',
    amount: 5000,
    currency: 'TZS',
    method: 'mobile_money',
    provider: PaymentProvider.VODACOM_MPESA,
    destination: {
      type: 'mobile_wallet',
      accountIdentifier: '+255700000001',
      accountName: 'Recipient One',
      mobileNumber: '+255700000001',
    },
    status: 'pending',
    providerPayoutId: null,
    batchId: null,
    scheduledAt: new Date('2025-01-01T00:00:00Z'),
    completedAt: null,
    ...overrides,
  }
}

describe('createVodacomMpesaAdapter', () => {
  let adapter: ReturnType<typeof createVodacomMpesaAdapter>

  beforeEach(() => {
    vi.clearAllMocks()
    adapter = createVodacomMpesaAdapter(config)
  })

  it('has correct provider', () => {
    expect(adapter.provider).toBe(PaymentProvider.VODACOM_MPESA)
  })

  describe('createIntent', () => {
    it('creates a C2B payment intent', async () => {
      mockC2bPayment.mockResolvedValueOnce({
        output_ResponseCode: 'INS-0',
        output_ResponseDesc: 'Success',
        output_TransactionID: 'txn-abc',
        output_ConversationID: 'conv-123',
        output_ThirdPartyConversationID: 'idem-key',
      })

      const result = await adapter.createIntent({
        orderId: 'order-1',
        userId: 'user-1',
        amount: 5000,
        currency: 'TZS',
        method: 'mobile_money',
        idempotencyKey: 'idem-key',
        metadata: { phoneNumber: '+255712345678' },
      })

      expect(result.status).toBe(PaymentIntentStatus.PROCESSING)
      expect(result.provider).toBe(PaymentProvider.VODACOM_MPESA)
      expect(result.providerIntentId).toBe('txn-abc')
      expect(result.metadata?.market).toBe('TZ')
      expect(mockC2bPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          input_CustomerMSISDN: '+255712345678',
          input_Amount: '5000',
          input_ServiceProviderCode: 'SP001',
        }),
      )
    })

    it('throws when phoneNumber is missing', async () => {
      await expect(
        adapter.createIntent({
          orderId: 'order-1',
          userId: 'user-1',
          amount: 5000,
          currency: 'TZS',
          method: 'mobile_money',
          idempotencyKey: 'idem-key',
          metadata: {},
        }),
      ).rejects.toThrow(VodacomMpesaError)
    })
  })

  describe('captureIntent', () => {
    it('captures a completed payment', async () => {
      mockQueryTransactionStatus.mockResolvedValueOnce({
        output_ResponseCode: 'INS-0',
        output_ResponseDesc: 'Success',
        output_ResponseTransactionStatus: 'Completed',
        output_ConversationID: 'conv-123',
        output_ThirdPartyConversationID: 'tp-123',
      })

      const result = await adapter.captureIntent('intent-1')
      expect(result.intentId).toBe('intent-1')
      expect(result.capturedAt).toBeInstanceOf(Date)
    })

    it('throws when transaction is not completed', async () => {
      mockQueryTransactionStatus.mockResolvedValueOnce({
        output_ResponseCode: 'INS-0',
        output_ResponseDesc: 'Pending',
        output_ResponseTransactionStatus: 'Pending',
        output_ConversationID: 'conv-123',
        output_ThirdPartyConversationID: 'tp-123',
      })

      await expect(adapter.captureIntent('intent-1')).rejects.toThrow('not completed')
    })

    it('accepts SUCCESS status', async () => {
      mockQueryTransactionStatus.mockResolvedValueOnce({
        output_ResponseCode: 'INS-0',
        output_ResponseDesc: 'OK',
        output_ResponseTransactionStatus: 'Success',
        output_ConversationID: 'conv-456',
        output_ThirdPartyConversationID: 'tp-456',
      })

      const result = await adapter.captureIntent('intent-2')
      expect(result.intentId).toBe('intent-2')
    })
  })

  describe('refundIntent', () => {
    it('initiates a reversal', async () => {
      mockReverseTransaction.mockResolvedValueOnce({
        output_ResponseCode: 'INS-0',
        output_ResponseDesc: 'Reversal success',
        output_TransactionID: 'rev-txn-1',
        output_ConversationID: 'conv-rev',
        output_ThirdPartyConversationID: 'tp-rev',
      })

      const result = await adapter.refundIntent('intent-1', 2000, 'customer request')
      expect(result.intentId).toBe('intent-1')
      expect(result.amount).toBe(2000)
      expect(result.reason).toBe('customer request')
      expect(result.status).toBe('processing')
      expect(mockReverseTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          input_ReversalAmount: '2000',
          input_TransactionID: 'intent-1',
        }),
      )
    })
  })

  describe('createPayout', () => {
    it('throws unsupported operation error', async () => {
      await expect(adapter.createPayout(makePayoutInstruction())).rejects.toThrow(VodacomMpesaError)
      await expect(adapter.createPayout(makePayoutInstruction())).rejects.toThrow('not supported')
    })
  })

  describe('verifyWebhook', () => {
    it('returns true for valid payload with ThirdPartyConversationID', () => {
      const payload = JSON.stringify({ output_ThirdPartyConversationID: 'conv-123' })
      expect(adapter.verifyWebhook('some-sig', payload)).toBe(true)
    })

    it('returns false for empty signature', () => {
      expect(adapter.verifyWebhook('', '{}')).toBe(false)
    })

    it('returns false for empty payload', () => {
      expect(adapter.verifyWebhook('sig', '')).toBe(false)
    })

    it('returns false for invalid JSON', () => {
      expect(adapter.verifyWebhook('sig', 'not-json')).toBe(false)
    })

    it('returns false when ThirdPartyConversationID is missing', () => {
      expect(adapter.verifyWebhook('sig', '{}')).toBe(false)
    })

    it('returns false when ThirdPartyConversationID is empty string', () => {
      const payload = JSON.stringify({ output_ThirdPartyConversationID: '' })
      expect(adapter.verifyWebhook('sig', payload)).toBe(false)
    })
  })
})
