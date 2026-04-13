import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MpesaResponseCode } from './vodacom-mpesa.types'

// Mock node:crypto for RSA encryption
vi.mock('node:crypto', () => ({
  publicEncrypt: vi.fn(() => Buffer.from('encrypted-token')),
  constants: { RSA_PKCS1_PADDING: 1 },
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { generateBearerToken, createVodacomMpesaClient } from './vodacom-mpesa.client'

const config = {
  baseUrl: 'https://openapi.m-pesa.com/sandbox',
  apiKey: 'test-api-key',
  publicKey: 'MIICIjANBg...',
  serviceProviderCode: '000000',
  callbackUrl: 'https://example.com/callback',
}

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Server Error',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  }
}

describe('generateBearerToken', () => {
  it('encrypts API key and returns base64', () => {
    const token = generateBearerToken('api-key', '-----BEGIN PUBLIC KEY-----\nMIIC\n-----END PUBLIC KEY-----')
    expect(token).toBe(Buffer.from('encrypted-token').toString('base64'))
  })

  it('wraps raw key in PEM headers', () => {
    // Just verify it doesn't throw when given raw key
    const token = generateBearerToken('key', 'MIICIjANBg')
    expect(typeof token).toBe('string')
  })
})

describe('createVodacomMpesaClient', () => {
  let client: ReturnType<typeof createVodacomMpesaClient>

  beforeEach(() => {
    vi.clearAllMocks()
    client = createVodacomMpesaClient(config)
  })

  describe('c2bPayment', () => {
    it('sends POST to c2bPayment endpoint', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        output_ResponseCode: MpesaResponseCode.SUCCESS,
        output_ResponseDesc: 'Success',
        output_TransactionID: 'txn-123',
        output_ConversationID: 'conv-123',
        output_ThirdPartyConversationID: 'tp-123',
      }))

      const result = await client.c2bPayment({
        input_Amount: '1000',
        input_Country: 'TZN',
        input_Currency: 'TZS',
        input_CustomerMSISDN: '000000000001',
        input_ServiceProviderCode: '000000',
        input_ThirdPartyConversationID: 'tp-1',
        input_TransactionReference: 'ref-1',
        input_PurchasedItemsDesc: 'Test payment',
      })

      expect(result.output_TransactionID).toBe('txn-123')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/c2bPayment/'),
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('throws VodacomMpesaError for HTTP error', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse('Server Error', 500))

      await expect(client.c2bPayment({
        input_Amount: '1000',
        input_Country: 'TZN',
        input_Currency: 'TZS',
        input_CustomerMSISDN: '000',
        input_ServiceProviderCode: '000',
        input_ThirdPartyConversationID: 'tp-err',
        input_TransactionReference: 'ref-err',
        input_PurchasedItemsDesc: 'Test',
      })).rejects.toThrow('HTTP 500')
    })

    it('throws VodacomMpesaError for application-level error', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        output_ResponseCode: 'INS-1',
        output_ResponseDesc: 'Insufficient balance',
      }))

      await expect(client.c2bPayment({
        input_Amount: '99999',
        input_Country: 'TZN',
        input_Currency: 'TZS',
        input_CustomerMSISDN: '000',
        input_ServiceProviderCode: '000',
        input_ThirdPartyConversationID: 'tp-app-err',
        input_TransactionReference: 'ref-app-err',
        input_PurchasedItemsDesc: 'Test',
      })).rejects.toThrow('M-Pesa error INS-1')
    })
  })

  describe('queryTransactionStatus', () => {
    it('sends GET with query params', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        output_ResponseCode: MpesaResponseCode.SUCCESS,
        output_ResponseDesc: 'Success',
        output_TransactionStatus: 'Completed',
      }))

      const result = await client.queryTransactionStatus({
        input_QueryReference: 'ref-1',
        input_ServiceProviderCode: '000000',
        input_ThirdPartyConversationID: 'tp-query',
      })

      expect(result.output_ResponseCode).toBe(MpesaResponseCode.SUCCESS)
      const callUrl = mockFetch.mock.calls[0]![0] as string
      expect(callUrl).toContain('queryTransactionStatus')
      expect(callUrl).toContain('input_QueryReference=ref-1')
    })

    it('throws for GET error responses', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse('Not Found', 404))

      await expect(client.queryTransactionStatus({
        input_QueryReference: 'ref-bad',
        input_ServiceProviderCode: '000',
        input_ThirdPartyConversationID: 'tp-bad',
      })).rejects.toThrow('HTTP 404')
    })
  })

  describe('reverseTransaction', () => {
    it('sends POST to reversal endpoint', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        output_ResponseCode: MpesaResponseCode.SUCCESS,
        output_ResponseDesc: 'Reversed',
        output_TransactionID: 'rev-123',
        output_ConversationID: 'conv-rev',
        output_ThirdPartyConversationID: 'tp-rev',
      }))

      const result = await client.reverseTransaction({
        input_ReversalAmount: '500',
        input_Country: 'TZN',
        input_ServiceProviderCode: '000000',
        input_ThirdPartyConversationID: 'tp-rev-1',
        input_TransactionID: 'txn-to-reverse',
      })

      expect(result.output_TransactionID).toBe('rev-123')
    })
  })
})
