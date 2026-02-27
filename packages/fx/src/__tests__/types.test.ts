/**
 * Unit tests — @nzila/fx/types
 *
 * Covers: Zod schemas, CURRENCY_INFO, SUPPORTED_CURRENCIES
 */
import { describe, it, expect } from 'vitest'
import {
  SUPPORTED_CURRENCIES,
  CURRENCY_INFO,
  CurrencyCodeSchema,
  MonetaryAmountSchema,
  ConversionRequestSchema,
  EntityCurrencyConfigSchema,
} from '../types'

describe('SUPPORTED_CURRENCIES', () => {
  it('has 24 currencies', () => {
    expect(SUPPORTED_CURRENCIES).toHaveLength(24)
  })

  it('includes CAD, USD, EUR, GBP, JPY', () => {
    expect(SUPPORTED_CURRENCIES).toContain('CAD')
    expect(SUPPORTED_CURRENCIES).toContain('USD')
    expect(SUPPORTED_CURRENCIES).toContain('EUR')
    expect(SUPPORTED_CURRENCIES).toContain('GBP')
    expect(SUPPORTED_CURRENCIES).toContain('JPY')
  })
})

describe('CURRENCY_INFO', () => {
  it('JPY has 0 decimals', () => {
    expect(CURRENCY_INFO.JPY.decimals).toBe(0)
  })

  it('CAD has 2 decimals', () => {
    expect(CURRENCY_INFO.CAD.decimals).toBe(2)
  })

  it('KRW has 0 decimals', () => {
    expect(CURRENCY_INFO.KRW.decimals).toBe(0)
  })

  it('every supported currency has info', () => {
    for (const code of SUPPORTED_CURRENCIES) {
      expect(CURRENCY_INFO[code]).toBeDefined()
      expect(CURRENCY_INFO[code].code).toBe(code)
      expect(CURRENCY_INFO[code].name).toBeTruthy()
      expect(CURRENCY_INFO[code].symbol).toBeTruthy()
      expect(typeof CURRENCY_INFO[code].decimals).toBe('number')
      expect(typeof CURRENCY_INFO[code].numericCode).toBe('number')
    }
  })
})

describe('CurrencyCodeSchema', () => {
  it('accepts valid currency codes', () => {
    expect(CurrencyCodeSchema.parse('CAD')).toBe('CAD')
    expect(CurrencyCodeSchema.parse('USD')).toBe('USD')
  })

  it('rejects invalid codes', () => {
    expect(() => CurrencyCodeSchema.parse('XYZ')).toThrow()
    expect(() => CurrencyCodeSchema.parse('')).toThrow()
    expect(() => CurrencyCodeSchema.parse('cad')).toThrow()
  })
})

describe('MonetaryAmountSchema', () => {
  it('accepts valid monetary amount', () => {
    const result = MonetaryAmountSchema.parse({ amount: 100.50, currency: 'CAD' })
    expect(result.amount).toBe(100.50)
    expect(result.currency).toBe('CAD')
  })

  it('rejects missing currency', () => {
    expect(() => MonetaryAmountSchema.parse({ amount: 100 })).toThrow()
  })

  it('rejects invalid currency', () => {
    expect(() => MonetaryAmountSchema.parse({ amount: 100, currency: 'XYZ' })).toThrow()
  })
})

describe('ConversionRequestSchema', () => {
  it('accepts valid request', () => {
    const result = ConversionRequestSchema.parse({
      amount: 100,
      from: 'USD',
      to: 'CAD',
    })
    expect(result.amount).toBe(100)
    expect(result.rounding).toBe('half-even') // default
  })

  it('accepts request with date', () => {
    const result = ConversionRequestSchema.parse({
      amount: 50,
      from: 'EUR',
      to: 'CAD',
      date: '2025-01-15',
    })
    expect(result.date).toBe('2025-01-15')
  })

  it('rejects invalid date format', () => {
    expect(() => ConversionRequestSchema.parse({
      amount: 100,
      from: 'USD',
      to: 'CAD',
      date: 'January 15',
    })).toThrow()
  })

  it('rejects non-positive amount', () => {
    expect(() => ConversionRequestSchema.parse({
      amount: -100,
      from: 'USD',
      to: 'CAD',
    })).toThrow()
  })
})

describe('EntityCurrencyConfigSchema', () => {
  it('accepts valid config with defaults', () => {
    const result = EntityCurrencyConfigSchema.parse({
      entityId: '00000000-0000-0000-0000-000000000001',
    })
    expect(result.functionalCurrency).toBe('CAD')
    expect(result.transactionCurrencies).toEqual(['CAD'])
    expect(result.rateSource).toBe('bank_of_canada')
    expect(result.autoRevalue).toBe(false)
  })

  it('accepts full config', () => {
    const result = EntityCurrencyConfigSchema.parse({
      entityId: '00000000-0000-0000-0000-000000000001',
      functionalCurrency: 'USD',
      transactionCurrencies: ['USD', 'CAD', 'EUR'],
      rateSource: 'ecb',
      autoRevalue: true,
    })
    expect(result.functionalCurrency).toBe('USD')
    expect(result.rateSource).toBe('ecb')
    expect(result.autoRevalue).toBe(true)
  })

  it('rejects non-UUID entityId', () => {
    expect(() => EntityCurrencyConfigSchema.parse({
      entityId: 'not-a-uuid',
    })).toThrow()
  })
})
