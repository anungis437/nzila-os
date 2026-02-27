/**
 * Unit tests — @nzila/fx/rates
 *
 * Covers: getRate, previousBusinessDay, isBusinessDay, invertRate
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  getRate,
  invertRate,
  previousBusinessDay,
  isBusinessDay,
  setDefaultRateProvider,
} from '../rates'
import { createManualRateProvider } from '../boc'

describe('previousBusinessDay', () => {
  it('Tuesday → Monday', () => {
    expect(previousBusinessDay('2025-01-14')).toBe('2025-01-13') // Tue → Mon
  })

  it('Monday → Friday', () => {
    expect(previousBusinessDay('2025-01-13')).toBe('2025-01-10') // Mon → Fri
  })

  it('Sunday → Friday', () => {
    expect(previousBusinessDay('2025-01-12')).toBe('2025-01-10') // Sun → Fri
  })

  it('Saturday → Friday', () => {
    // Saturday (2025-01-11) → previous day = Friday
    expect(previousBusinessDay('2025-01-11')).toBe('2025-01-10')
  })

  it('Wednesday → Tuesday', () => {
    expect(previousBusinessDay('2025-01-15')).toBe('2025-01-14')
  })
})

describe('isBusinessDay', () => {
  it('Monday is a business day', () => {
    expect(isBusinessDay('2025-01-13')).toBe(true) // Monday
  })

  it('Friday is a business day', () => {
    expect(isBusinessDay('2025-01-17')).toBe(true)
  })

  it('Saturday is not a business day', () => {
    expect(isBusinessDay('2025-01-18')).toBe(false)
  })

  it('Sunday is not a business day', () => {
    expect(isBusinessDay('2025-01-19')).toBe(false)
  })
})

describe('invertRate', () => {
  it('inverts base/quote and calculates reciprocal', () => {
    const inverted = invertRate({
      baseCurrency: 'USD',
      quoteCurrency: 'CAD',
      rate: 1.35,
      rateDate: '2025-01-15',
      source: 'bank_of_canada',
      fetchedAt: '2025-01-15T12:00:00Z',
    })

    expect(inverted.baseCurrency).toBe('CAD')
    expect(inverted.quoteCurrency).toBe('USD')
    expect(inverted.rate).toBeCloseTo(1 / 1.35, 10)
  })
})

describe('getRate', () => {
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
  ])

  beforeEach(() => {
    setDefaultRateProvider(manualProvider)
  })

  it('same currency returns rate = 1', async () => {
    const rate = await getRate('CAD', 'CAD', '2025-01-15')
    expect(rate).not.toBeNull()
    expect(rate!.rate).toBe(1)
    expect(rate!.source).toBe('fallback')
  })

  it('direct rate lookup', async () => {
    const rate = await getRate('USD', 'CAD', '2025-01-15', { provider: manualProvider })
    expect(rate).not.toBeNull()
    expect(rate!.rate).toBe(1.35)
  })

  it('inverse rate (CAD → USD)', async () => {
    const rate = await getRate('CAD', 'USD', '2025-01-15', { provider: manualProvider })
    expect(rate).not.toBeNull()
    expect(rate!.rate).toBeCloseTo(1 / 1.35, 6)
  })

  it('cross rate (USD → EUR via CAD)', async () => {
    const rate = await getRate('USD', 'EUR', '2025-01-15', { provider: manualProvider })
    expect(rate).not.toBeNull()
    // USD → CAD = 1.35, CAD → EUR = 1/1.50
    // USD → EUR = 1.35 / 1.50 = 0.9
    expect(rate!.rate).toBeCloseTo(0.9, 6)
  })

  it('returns null for unavailable currency', async () => {
    const emptyProvider = createManualRateProvider([])
    const rate = await getRate('USD', 'CAD', '2025-01-15', {
      provider: emptyProvider,
      maxFallbackDays: 0,
    })
    expect(rate).toBeNull()
  })
})
