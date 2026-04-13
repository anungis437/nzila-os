import { describe, it, expect } from 'vitest'
import {
  VodacomMpesaError,
  isRetryableCode,
  MpesaResponseCode,
  VodacomMpesaConfigSchema,
} from './adapters/vodacom-mpesa.types'

describe('isRetryableCode', () => {
  it('returns true for TIMEOUT', () => {
    expect(isRetryableCode(MpesaResponseCode.TIMEOUT)).toBe(true)
  })

  it('returns true for SERVICE_UNAVAILABLE', () => {
    expect(isRetryableCode(MpesaResponseCode.SERVICE_UNAVAILABLE)).toBe(true)
  })

  it('returns true for REQUEST_THROTTLED', () => {
    expect(isRetryableCode(MpesaResponseCode.REQUEST_THROTTLED)).toBe(true)
  })

  it('returns true for INTERNAL_ERROR', () => {
    expect(isRetryableCode(MpesaResponseCode.INTERNAL_ERROR)).toBe(true)
  })

  it('returns false for SUCCESS', () => {
    expect(isRetryableCode(MpesaResponseCode.SUCCESS)).toBe(false)
  })

  it('returns false for INVALID_API_KEY', () => {
    expect(isRetryableCode(MpesaResponseCode.INVALID_API_KEY)).toBe(false)
  })

  it('returns false for DUPLICATE_TRANSACTION', () => {
    expect(isRetryableCode(MpesaResponseCode.DUPLICATE_TRANSACTION)).toBe(false)
  })

  it('returns false for INSUFFICIENT_BALANCE', () => {
    expect(isRetryableCode(MpesaResponseCode.INSUFFICIENT_BALANCE)).toBe(false)
  })

  it('returns false for unknown codes', () => {
    expect(isRetryableCode('UNKNOWN')).toBe(false)
  })
})

describe('VodacomMpesaError', () => {
  it('creates error with all properties', () => {
    const err = new VodacomMpesaError('test msg', 'INS-1', 'desc', 'conv-123', true)
    expect(err.message).toBe('test msg')
    expect(err.name).toBe('VodacomMpesaError')
    expect(err.responseCode).toBe('INS-1')
    expect(err.responseDesc).toBe('desc')
    expect(err.conversationId).toBe('conv-123')
    expect(err.isRetryable).toBe(true)
  })

  it('defaults isRetryable to false', () => {
    const err = new VodacomMpesaError('test', 'INS-2', 'bad key')
    expect(err.isRetryable).toBe(false)
  })

  it('is instanceof Error', () => {
    const err = new VodacomMpesaError('test', 'INS-1', 'desc')
    expect(err).toBeInstanceOf(Error)
  })
})

describe('VodacomMpesaConfigSchema', () => {
  it('validates a correct config', () => {
    const config = {
      baseUrl: 'https://openapi.m-pesa.com',
      apiKey: 'test-key',
      publicKey: 'test-public-key',
      serviceProviderCode: '000000',
      market: 'TZ' as const,
    }
    expect(() => VodacomMpesaConfigSchema.parse(config)).not.toThrow()
  })

  it('rejects invalid market', () => {
    const config = {
      baseUrl: 'https://openapi.m-pesa.com',
      apiKey: 'key',
      publicKey: 'pk',
      serviceProviderCode: '000',
      market: 'XX',
    }
    expect(() => VodacomMpesaConfigSchema.parse(config)).toThrow()
  })

  it('rejects empty apiKey', () => {
    const config = {
      baseUrl: 'https://openapi.m-pesa.com',
      apiKey: '',
      publicKey: 'pk',
      serviceProviderCode: '000',
      market: 'TZ',
    }
    expect(() => VodacomMpesaConfigSchema.parse(config)).toThrow()
  })

  it('allows optional callbackUrl', () => {
    const config = {
      baseUrl: 'https://openapi.m-pesa.com',
      apiKey: 'key',
      publicKey: 'pk',
      serviceProviderCode: '000',
      market: 'MZ' as const,
      callbackUrl: 'https://example.com/callback',
    }
    expect(() => VodacomMpesaConfigSchema.parse(config)).not.toThrow()
  })
})

describe('MpesaResponseCode', () => {
  it('SUCCESS is INS-0', () => {
    expect(MpesaResponseCode.SUCCESS).toBe('INS-0')
  })

  it('has expected codes', () => {
    expect(MpesaResponseCode.INTERNAL_ERROR).toBe('INS-1')
    expect(MpesaResponseCode.INSUFFICIENT_BALANCE).toBe('INS-5')
    expect(MpesaResponseCode.TIMEOUT).toBe('INS-15')
    expect(MpesaResponseCode.TRANSACTION_NOT_FOUND).toBe('INS-17')
  })
})
