/**
 * Unit tests — @nzila/fx/boc
 *
 * Covers: BoC series mapping, manual rate provider, cross-rate calculation
 * (BoC API calls are integration tests — not tested here)
 */
import { describe, it, expect } from 'vitest'
import {
  BOC_SERIES,
  BOC_SUPPORTED_CURRENCIES,
  createManualRateProvider,
} from '../boc'

describe('BOC_SERIES', () => {
  it('maps USD to FXUSDCAD', () => {
    expect(BOC_SERIES.USD).toBe('FXUSDCAD')
  })

  it('maps EUR to FXEURCAD', () => {
    expect(BOC_SERIES.EUR).toBe('FXEURCAD')
  })

  it('maps GBP to FXGBPCAD', () => {
    expect(BOC_SERIES.GBP).toBe('FXGBPCAD')
  })

  it('does not include CAD (BoC only publishes foreign-to-CAD)', () => {
    expect(BOC_SERIES).not.toHaveProperty('CAD')
  })
})

describe('BOC_SUPPORTED_CURRENCIES', () => {
  it('includes major currencies', () => {
    expect(BOC_SUPPORTED_CURRENCIES).toContain('USD')
    expect(BOC_SUPPORTED_CURRENCIES).toContain('EUR')
    expect(BOC_SUPPORTED_CURRENCIES).toContain('GBP')
    expect(BOC_SUPPORTED_CURRENCIES).toContain('JPY')
  })

  it('does not include CAD', () => {
    expect(BOC_SUPPORTED_CURRENCIES).not.toContain('CAD')
  })
})

describe('createManualRateProvider', () => {
  const provider = createManualRateProvider([
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
  ])

  it('has source "manual"', () => {
    expect(provider.source).toBe('manual')
  })

  describe('getRate', () => {
    it('returns direct rate', async () => {
      const rate = await provider.getRate('USD', 'CAD', '2025-01-15')
      expect(rate).not.toBeNull()
      expect(rate!.rate).toBe(1.35)
      expect(rate!.baseCurrency).toBe('USD')
      expect(rate!.quoteCurrency).toBe('CAD')
    })

    it('returns inverse rate (CAD → USD)', async () => {
      const rate = await provider.getRate('CAD', 'USD', '2025-01-15')
      expect(rate).not.toBeNull()
      expect(rate!.rate).toBeCloseTo(1 / 1.35, 10)
      expect(rate!.baseCurrency).toBe('CAD')
      expect(rate!.quoteCurrency).toBe('USD')
    })

    it('returns cross rate (USD → EUR via CAD)', async () => {
      const rate = await provider.getRate('USD', 'EUR', '2025-01-15')
      expect(rate).not.toBeNull()
      // USD → CAD = 1.35, CAD → EUR = 1/1.50
      // USD → EUR = 1.35 / 1.50 = 0.9
      expect(rate!.rate).toBeCloseTo(0.9, 6)
    })

    it('returns same-currency rate = 1', async () => {
      const rate = await provider.getRate('USD', 'USD', '2025-01-15')
      expect(rate).not.toBeNull()
      expect(rate!.rate).toBe(1)
    })

    it('returns null for unavailable date', async () => {
      const rate = await provider.getRate('USD', 'CAD', '2099-01-01')
      expect(rate).toBeNull()
    })
  })

  describe('getDailyRates', () => {
    it('returns rates for the given date', async () => {
      const sheet = await provider.getDailyRates('2025-01-15')
      expect(sheet.date).toBe('2025-01-15')
      expect(sheet.source).toBe('manual')
      expect(sheet.rates).toHaveProperty('USD')
      expect(sheet.rates).toHaveProperty('EUR')
      expect(sheet.rates['USD']).toBe(1.35)
      expect(sheet.rates['EUR']).toBe(1.50)
    })

    it('returns empty rates for unavailable date', async () => {
      const sheet = await provider.getDailyRates('2099-01-01')
      // Only CAD: 1 remains (no manual rates for that date)
      expect(Object.keys(sheet.rates)).toHaveLength(1)
      expect(sheet.rates['CAD']).toBe(1)
    })
  })
})
