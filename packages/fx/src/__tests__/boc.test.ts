/**
 * Unit tests — @nzila/fx/boc
 *
 * Covers: BoC series mapping, manual rate provider, cross-rate calculation
 * (BoC API calls are integration tests — not tested here)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  BOC_SERIES,
  BOC_SUPPORTED_CURRENCIES,
  fetchBocRate,
  fetchBocDailyRates,
  fetchBocRateRange,
  createBocRateProvider,
  createManualRateProvider,
} from '../boc'
import { RateCache } from '../cache'

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

describe('fetchBocRate', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns CAD self-rate without network calls', async () => {
    const result = await fetchBocRate('CAD', '2025-01-15')
    expect(result).not.toBeNull()
    expect(result!.rate).toBe(1)
    expect(result!.baseCurrency).toBe('CAD')
  })

  it('returns cached value when present', async () => {
    const cache = new RateCache()
    cache.set({
      baseCurrency: 'USD',
      quoteCurrency: 'CAD',
      rate: 1.42,
      rateDate: '2025-01-15',
      source: 'manual',
      fetchedAt: '2025-01-15T00:00:00Z',
    })

    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const result = await fetchBocRate('USD', '2025-01-15', { cache })
    expect(result).not.toBeNull()
    expect(result!.rate).toBe(1.42)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns null for unsupported currency', async () => {
    const result = await fetchBocRate('CADX' as never, '2025-01-15')
    expect(result).toBeNull()
  })

  it('returns null for non-ok API response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })))
    const result = await fetchBocRate('USD', '2025-01-15')
    expect(result).toBeNull()
  })

  it('returns null when observation or numeric value is invalid', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ observations: [{ d: '2025-01-15', FXUSDCAD: { v: 'NaN' } }] }),
    })))

    const result = await fetchBocRate('USD', '2025-01-15')
    expect(result).toBeNull()
  })

  it('parses valid API response and writes to cache', async () => {
    const cache = new RateCache()
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ observations: [{ d: '2025-01-15', FXUSDCAD: { v: '1.37' } }] }),
    })))

    const result = await fetchBocRate('USD', '2025-01-15', { cache })
    expect(result).not.toBeNull()
    expect(result!.rate).toBe(1.37)

    const cached = cache.get('USD', 'CAD', '2025-01-15')
    expect(cached).not.toBeNull()
    expect(cached!.rate).toBe(1.37)
  })
})

describe('fetchBocDailyRates', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns default sheet when API is non-ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })))

    const sheet = await fetchBocDailyRates('2025-01-15')
    expect(sheet.rates).toEqual({ CAD: 1 })
  })

  it('returns default sheet on network error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network down')
    }))

    const sheet = await fetchBocDailyRates('2025-01-15')
    expect(sheet.rates).toEqual({ CAD: 1 })
  })

  it('keeps valid rates and ignores invalid values', async () => {
    const cache = new RateCache()
    const setDailySpy = vi.spyOn(cache, 'setDailyRates')

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        observations: [{
          d: '2025-01-15',
          FXUSDCAD: { v: '1.35' },
          FXEURCAD: { v: '1.50' },
          FXGBPCAD: { v: '-1' },
          FXJPYCAD: { v: 'abc' },
        }],
      }),
    })))

    const sheet = await fetchBocDailyRates('2025-01-15', { cache })
    expect(sheet.rates['USD']).toBe(1.35)
    expect(sheet.rates['EUR']).toBe(1.5)
    expect(sheet.rates['GBP']).toBeUndefined()
    expect(sheet.rates['JPY']).toBeUndefined()
    expect(setDailySpy).toHaveBeenCalledTimes(1)
  })
})

describe('fetchBocRateRange', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns CAD self-rate for range requests', async () => {
    const out = await fetchBocRateRange('CAD', '2025-01-01', '2025-01-31')
    expect(out).toHaveLength(1)
    expect(out[0]!.rate).toBe(1)
  })

  it('returns empty list for unsupported currency', async () => {
    const out = await fetchBocRateRange('CADX' as never, '2025-01-01', '2025-01-31')
    expect(out).toEqual([])
  })

  it('filters invalid points and keeps valid observations', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        observations: [
          { d: '2025-01-01', FXUSDCAD: { v: '1.35' } },
          { d: '2025-01-02', FXUSDCAD: { v: '-1' } },
          { d: '2025-01-03', FXUSDCAD: { v: 'abc' } },
          { d: '2025-01-04', FXUSDCAD: { v: '1.36' } },
        ],
      }),
    })))

    const out = await fetchBocRateRange('USD', '2025-01-01', '2025-01-04')
    expect(out).toHaveLength(2)
    expect(out[0]!.rateDate).toBe('2025-01-01')
    expect(out[1]!.rateDate).toBe('2025-01-04')
  })

  it('returns empty list when request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })))
    expect(await fetchBocRateRange('USD', '2025-01-01', '2025-01-02')).toEqual([])
  })
})

describe('createBocRateProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns same-currency rate = 1', async () => {
    const provider = createBocRateProvider(new RateCache())
    const rate = await provider.getRate('USD', 'USD', '2025-01-15')
    expect(rate).not.toBeNull()
    expect(rate!.rate).toBe(1)
  })

  it('returns direct quote-to-CAD via fetch path', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ observations: [{ d: '2025-01-15', FXUSDCAD: { v: '1.4' } }] }),
    })))

    const provider = createBocRateProvider(new RateCache())
    const rate = await provider.getRate('USD', 'CAD', '2025-01-15')
    expect(rate).not.toBeNull()
    expect(rate!.rate).toBe(1.4)
  })

  it('inverts quote when base is CAD', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ observations: [{ d: '2025-01-15', FXUSDCAD: { v: '1.25' } }] }),
    })))

    const provider = createBocRateProvider(new RateCache())
    const rate = await provider.getRate('CAD', 'USD', '2025-01-15')
    expect(rate).not.toBeNull()
    expect(rate!.rate).toBeCloseTo(0.8, 6)
  })

  it('returns cross-rate base -> CAD -> quote', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('FXUSDCAD')) {
        return {
          ok: true,
          json: async () => ({ observations: [{ d: '2025-01-15', FXUSDCAD: { v: '1.35' } }] }),
        }
      }
      return {
        ok: true,
        json: async () => ({ observations: [{ d: '2025-01-15', FXEURCAD: { v: '1.5' } }] }),
      }
    }))

    const provider = createBocRateProvider(new RateCache())
    const rate = await provider.getRate('USD', 'EUR', '2025-01-15')
    expect(rate).not.toBeNull()
    expect(rate!.rate).toBeCloseTo(1.35 / 1.5, 6)
  })

  it('returns null when one side of cross-rate is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('FXUSDCAD')) {
        return {
          ok: true,
          json: async () => ({ observations: [{ d: '2025-01-15', FXUSDCAD: { v: '1.35' } }] }),
        }
      }
      return { ok: false }
    }))

    const provider = createBocRateProvider(new RateCache())
    const rate = await provider.getRate('USD', 'EUR', '2025-01-15')
    expect(rate).toBeNull()
  })
})

describe('barrel exports', () => {
  it('exposes fx package public API', async () => {
    const api = await import('../index')
    expect(typeof api.fetchBocRate).toBe('function')
    expect(typeof api.getRate).toBe('function')
    expect(typeof api.createDualAmount).toBe('function')
  })
})
