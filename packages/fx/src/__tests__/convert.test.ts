/**
 * Unit tests — @nzila/fx/convert
 *
 * Covers: convertCurrency, convertToFunctional, convertFromFunctional,
 *         formatMoney, formatDualCurrency, roundAmount
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  convertCurrency,
  convertToFunctional,
  convertFromFunctional,
  formatMoney,
  formatDualCurrency,
  roundAmount,
} from '../convert'
import { createManualRateProvider } from '../boc'
import { setDefaultRateProvider } from '../rates'
import type { EntityCurrencyConfig, MonetaryAmount } from '../types'

const manualProvider = createManualRateProvider([
  {
    baseCurrency: 'USD',
    quoteCurrency: 'CAD',
    rate: 1.35,
    rateDate: '2025-01-15',
    source: 'manual',
    fetchedAt: '2025-01-15T00:00:00Z',
  },
  {
    baseCurrency: 'EUR',
    quoteCurrency: 'CAD',
    rate: 1.50,
    rateDate: '2025-01-15',
    source: 'manual',
    fetchedAt: '2025-01-15T00:00:00Z',
  },
  {
    baseCurrency: 'JPY',
    quoteCurrency: 'CAD',
    rate: 0.0092,
    rateDate: '2025-01-15',
    source: 'manual',
    fetchedAt: '2025-01-15T00:00:00Z',
  },
])

const cadConfig: EntityCurrencyConfig = {
  entityId: '00000000-0000-0000-0000-000000000001',
  functionalCurrency: 'CAD',
  transactionCurrencies: ['CAD', 'USD', 'EUR'],
  rateSource: 'manual',
  autoRevalue: false,
}

describe('roundAmount', () => {
  it('half-up rounding: 2.5 → 3', () => {
    expect(roundAmount(2.5, 0, 'half-up')).toBe(3)
  })

  it('half-even (banker) rounding: 2.5 → 2', () => {
    expect(roundAmount(2.5, 0, 'half-even')).toBe(2)
  })

  it('half-even: 3.5 → 4', () => {
    expect(roundAmount(3.5, 0, 'half-even')).toBe(4)
  })

  it('rounds to 2 decimal places', () => {
    expect(roundAmount(1.235, 2, 'half-up')).toBe(1.24)
  })

  it('JPY: rounds to 0 decimal places', () => {
    expect(roundAmount(1234.56, 0, 'half-up')).toBe(1235)
  })
})

describe('convertCurrency', () => {
  beforeEach(() => {
    setDefaultRateProvider(manualProvider)
  })

  it('same currency returns identity conversion', async () => {
    const result = await convertCurrency(
      { amount: 100, from: 'CAD', to: 'CAD', date: '2025-01-15' },
      { provider: manualProvider },
    )
    expect(result.convertedAmount).toBe(100)
    expect(result.exchangeRate).toBe(1)
    expect(result.rateSource).toBe('fallback')
  })

  it('USD → CAD conversion', async () => {
    const result = await convertCurrency(
      { amount: 1000, from: 'USD', to: 'CAD', date: '2025-01-15' },
      { provider: manualProvider },
    )
    expect(result.convertedAmount).toBe(1350)
    expect(result.exchangeRate).toBe(1.35)
    expect(result.originalAmount).toBe(1000)
    expect(result.originalCurrency).toBe('USD')
    expect(result.targetCurrency).toBe('CAD')
  })

  it('CAD → USD inverse conversion', async () => {
    const result = await convertCurrency(
      { amount: 1350, from: 'CAD', to: 'USD', date: '2025-01-15' },
      { provider: manualProvider },
    )
    expect(result.convertedAmount).toBeCloseTo(1000, 0)
  })

  it('EUR → USD cross conversion via CAD', async () => {
    const result = await convertCurrency(
      { amount: 100, from: 'EUR', to: 'USD', date: '2025-01-15' },
      { provider: manualProvider },
    )
    // EUR → CAD = 1.50, CAD → USD = 1/1.35
    // EUR → USD = 1.50 / 1.35 ≈ 1.1111
    expect(result.convertedAmount).toBeCloseTo(111.11, 1)
  })

  it('throws for unavailable rate', async () => {
    const emptyProvider = createManualRateProvider([])
    await expect(
      convertCurrency(
        { amount: 100, from: 'USD', to: 'CAD', date: '2025-01-15' },
        { provider: emptyProvider },
      ),
    ).rejects.toThrow('No exchange rate available')
  })

  it('uses pre-fetched rate when provided', async () => {
    const result = await convertCurrency(
      { amount: 100, from: 'USD', to: 'CAD', date: '2025-01-15' },
      {
        rate: {
          baseCurrency: 'USD',
          quoteCurrency: 'CAD',
          rate: 1.40,
          rateDate: '2025-01-15',
          source: 'manual',
          fetchedAt: '2025-01-15T00:00:00Z',
        },
      },
    )
    expect(result.convertedAmount).toBe(140)
    expect(result.exchangeRate).toBe(1.40)
  })

  it('generates unique conversion IDs', async () => {
    const r1 = await convertCurrency(
      { amount: 100, from: 'USD', to: 'CAD', date: '2025-01-15' },
      { provider: manualProvider },
    )
    const r2 = await convertCurrency(
      { amount: 100, from: 'USD', to: 'CAD', date: '2025-01-15' },
      { provider: manualProvider },
    )
    expect(r1.conversionId).not.toBe(r2.conversionId)
  })

  it('JPY conversion rounds to 0 decimals', async () => {
    const result = await convertCurrency(
      { amount: 10000, from: 'JPY', to: 'CAD', date: '2025-01-15' },
      { provider: manualProvider },
    )
    // 10000 × 0.0092 = 92 CAD (2 decimals)
    expect(result.convertedAmount).toBe(92)
  })
})

describe('convertToFunctional', () => {
  beforeEach(() => {
    setDefaultRateProvider(manualProvider)
  })

  it('same currency returns identity', async () => {
    const amount: MonetaryAmount = { amount: 500, currency: 'CAD' }
    const result = await convertToFunctional(amount, cadConfig, '2025-01-15', { provider: manualProvider })

    expect(result.original.amount).toBe(500)
    expect(result.functional.amount).toBe(500)
    expect(result.exchangeRate).toBe(1)
  })

  it('USD → CAD functional conversion', async () => {
    const amount: MonetaryAmount = { amount: 1000, currency: 'USD' }
    const result = await convertToFunctional(amount, cadConfig, '2025-01-15', { provider: manualProvider })

    expect(result.original).toEqual({ amount: 1000, currency: 'USD' })
    expect(result.functional.amount).toBe(1350)
    expect(result.functional.currency).toBe('CAD')
    expect(result.exchangeRate).toBe(1.35)
  })
})

describe('convertFromFunctional', () => {
  beforeEach(() => {
    setDefaultRateProvider(manualProvider)
  })

  it('CAD → USD from functional', async () => {
    const amount: MonetaryAmount = { amount: 1350, currency: 'CAD' }
    const result = await convertFromFunctional(amount, 'USD', cadConfig, '2025-01-15', { provider: manualProvider })

    expect(result.functional).toEqual({ amount: 1350, currency: 'CAD' })
    expect(result.original.currency).toBe('USD')
    expect(result.original.amount).toBeCloseTo(1000, 0)
  })

  it('throws if amount currency does not match functional', async () => {
    const amount: MonetaryAmount = { amount: 1000, currency: 'USD' }
    await expect(
      convertFromFunctional(amount, 'EUR', cadConfig, '2025-01-15', { provider: manualProvider }),
    ).rejects.toThrow('does not match entity functional currency')
  })

  it('same target as functional returns identity', async () => {
    const amount: MonetaryAmount = { amount: 500, currency: 'CAD' }
    const result = await convertFromFunctional(amount, 'CAD', cadConfig, '2025-01-15', { provider: manualProvider })

    expect(result.original.amount).toBe(500)
    expect(result.functional.amount).toBe(500)
    expect(result.exchangeRate).toBe(1)
  })
})

describe('formatMoney', () => {
  it('formats CAD amount', () => {
    const formatted = formatMoney({ amount: 1234.56, currency: 'CAD' })
    expect(formatted).toMatch(/1.*234/)
    expect(formatted).toMatch(/56/)
  })

  it('formats JPY with 0 decimals', () => {
    const formatted = formatMoney({ amount: 10000, currency: 'JPY' })
    expect(formatted).toMatch(/10.*000/)
  })

  it('formats EUR', () => {
    const formatted = formatMoney({ amount: 99.99, currency: 'EUR' })
    expect(formatted).toMatch(/99/)
  })
})

describe('formatDualCurrency', () => {
  it('same currency shows single value', () => {
    const formatted = formatDualCurrency({
      original: { amount: 100, currency: 'CAD' },
      functional: { amount: 100, currency: 'CAD' },
      exchangeRate: 1,
      rateDate: '2025-01-15',
      rateSource: 'fallback',
    })
    // Should not include rate display for same currency
    expect(formatted).not.toContain('@')
  })

  it('different currencies show rate', () => {
    const formatted = formatDualCurrency({
      original: { amount: 1000, currency: 'USD' },
      functional: { amount: 1350, currency: 'CAD' },
      exchangeRate: 1.35,
      rateDate: '2025-01-15',
      rateSource: 'manual',
    })
    expect(formatted).toContain('1.3500')
  })
})
