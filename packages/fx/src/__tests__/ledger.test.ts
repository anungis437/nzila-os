/**
 * Unit tests — @nzila/fx/ledger
 *
 * Covers: createDualAmountFromRate, aggregateToFunctionalSync,
 *         calculateExposure, multiCurrencyTrialBalance
 */
import { describe, it, expect } from 'vitest'
import {
  createDualAmountFromRate,
  aggregateToFunctionalSync,
  calculateExposure,
  multiCurrencyTrialBalance,
} from '../ledger'
import type { MultiCurrencyEntry } from '../ledger'
import type { CurrencyCode, EntityCurrencyConfig, MonetaryAmount } from '../types'

const cadConfig: EntityCurrencyConfig = {
  entityId: '00000000-0000-0000-0000-000000000001',
  functionalCurrency: 'CAD',
  transactionCurrencies: ['CAD', 'USD', 'EUR'],
  rateSource: 'manual',
  autoRevalue: false,
}

describe('createDualAmountFromRate', () => {
  it('creates dual amount from known rate', () => {
    const dual = createDualAmountFromRate(1000, 'USD', cadConfig, 1.35, '2025-01-15')

    expect(dual.original).toEqual({ amount: 1000, currency: 'USD' })
    expect(dual.functional.amount).toBe(1350)
    expect(dual.functional.currency).toBe('CAD')
    expect(dual.exchangeRate).toBe(1.35)
    expect(dual.rateSource).toBe('manual')
  })

  it('same currency returns rate = 1', () => {
    const dual = createDualAmountFromRate(500, 'CAD', cadConfig, 1, '2025-01-15')

    expect(dual.original.amount).toBe(500)
    expect(dual.functional.amount).toBe(500)
    expect(dual.exchangeRate).toBe(1)
    expect(dual.rateSource).toBe('fallback')
  })

  it('rounds to functional currency decimals', () => {
    const dual = createDualAmountFromRate(100.50, 'USD', cadConfig, 1.3567, '2025-01-15')

    // 100.50 × 1.3567 = 136.3484 → rounded to 136.35
    expect(dual.functional.amount).toBeCloseTo(136.35, 2)
  })
})

describe('aggregateToFunctionalSync', () => {
  const rates = new Map<CurrencyCode, number>([
    ['USD', 1.35],
    ['EUR', 1.50],
  ])

  it('aggregates multiple currencies to CAD', () => {
    const amounts: MonetaryAmount[] = [
      { amount: 100, currency: 'CAD' },
      { amount: 100, currency: 'USD' },
      { amount: 100, currency: 'EUR' },
    ]

    const total = aggregateToFunctionalSync(amounts, cadConfig, rates, '2025-01-15')

    // 100 CAD + 100×1.35 CAD + 100×1.50 CAD = 100 + 135 + 150 = 385
    expect(total.amount).toBe(385)
    expect(total.currency).toBe('CAD')
  })

  it('CAD-only amounts pass through', () => {
    const amounts: MonetaryAmount[] = [
      { amount: 200, currency: 'CAD' },
      { amount: 300, currency: 'CAD' },
    ]

    const total = aggregateToFunctionalSync(amounts, cadConfig, rates, '2025-01-15')
    expect(total.amount).toBe(500)
  })

  it('throws for missing rate', () => {
    const amounts: MonetaryAmount[] = [
      { amount: 100, currency: 'GBP' }, // No GBP rate in map
    ]

    expect(() =>
      aggregateToFunctionalSync(amounts, cadConfig, rates, '2025-01-15'),
    ).toThrow('No rate available for GBP')
  })
})

describe('calculateExposure', () => {
  const entries: MultiCurrencyEntry[] = [
    {
      entryId: 'E001',
      accountCode: '1200',
      debit: {
        original: { amount: 1000, currency: 'USD' },
        functional: { amount: 1350, currency: 'CAD' },
        exchangeRate: 1.35,
        rateDate: '2025-01-15',
        rateSource: 'manual',
      },
      credit: null,
      date: '2025-01-15',
      entityId: 'entity-1',
    },
    {
      entryId: 'E002',
      accountCode: '4000',
      debit: null,
      credit: {
        original: { amount: 1000, currency: 'USD' },
        functional: { amount: 1350, currency: 'CAD' },
        exchangeRate: 1.35,
        rateDate: '2025-01-15',
        rateSource: 'manual',
      },
      date: '2025-01-15',
      entityId: 'entity-1',
    },
    {
      entryId: 'E003',
      accountCode: '1200',
      debit: {
        original: { amount: 500, currency: 'EUR' },
        functional: { amount: 750, currency: 'CAD' },
        exchangeRate: 1.50,
        rateDate: '2025-01-15',
        rateSource: 'manual',
      },
      credit: null,
      date: '2025-01-15',
      entityId: 'entity-1',
    },
  ]

  it('calculates exposure by currency', () => {
    const exposure = calculateExposure(entries, 'CAD')

    expect(exposure).toHaveLength(2) // USD and EUR

    const usd = exposure.find((e) => e.currency === 'USD')!
    expect(usd.totalDebit).toBe(1000)
    expect(usd.totalCredit).toBe(1000)
    expect(usd.netPosition).toBe(0) // Balanced
    expect(usd.entryCount).toBe(2)

    const eur = exposure.find((e) => e.currency === 'EUR')!
    expect(eur.totalDebit).toBe(500)
    expect(eur.totalCredit).toBe(0)
    expect(eur.netPosition).toBe(500)
    expect(eur.entryCount).toBe(1)
  })

  it('excludes functional currency entries', () => {
    const cadEntries: MultiCurrencyEntry[] = [
      {
        entryId: 'E004',
        accountCode: '1000',
        debit: {
          original: { amount: 500, currency: 'CAD' },
          functional: { amount: 500, currency: 'CAD' },
          exchangeRate: 1,
          rateDate: '2025-01-15',
          rateSource: 'fallback',
        },
        credit: null,
        date: '2025-01-15',
        entityId: 'entity-1',
      },
    ]

    const exposure = calculateExposure(cadEntries, 'CAD')
    expect(exposure).toHaveLength(0)
  })

  it('sorts by absolute functional exposure descending', () => {
    const exposure = calculateExposure(entries, 'CAD')
    // EUR has 750 functional net, USD has 0 functional net → EUR first
    expect(exposure[0]!.currency).toBe('EUR')
  })
})

describe('multiCurrencyTrialBalance', () => {
  const entries: MultiCurrencyEntry[] = [
    {
      entryId: 'E001',
      accountCode: '1200',
      debit: {
        original: { amount: 1000, currency: 'USD' },
        functional: { amount: 1350, currency: 'CAD' },
        exchangeRate: 1.35,
        rateDate: '2025-01-15',
        rateSource: 'manual',
      },
      credit: null,
      date: '2025-01-15',
      entityId: 'entity-1',
    },
    {
      entryId: 'E002',
      accountCode: '1200',
      debit: {
        original: { amount: 500, currency: 'USD' },
        functional: { amount: 675, currency: 'CAD' },
        exchangeRate: 1.35,
        rateDate: '2025-01-20',
        rateSource: 'manual',
      },
      credit: null,
      date: '2025-01-20',
      entityId: 'entity-1',
    },
    {
      entryId: 'E003',
      accountCode: '4000',
      debit: null,
      credit: {
        original: { amount: 1500, currency: 'USD' },
        functional: { amount: 2025, currency: 'CAD' },
        exchangeRate: 1.35,
        rateDate: '2025-01-15',
        rateSource: 'manual',
      },
      date: '2025-01-15',
      entityId: 'entity-1',
    },
  ]

  it('generates trial balance lines grouped by account × currency', () => {
    const tb = multiCurrencyTrialBalance(entries)

    expect(tb).toHaveLength(2) // 1200:USD and 4000:USD

    const ar = tb.find((l) => l.accountCode === '1200')!
    expect(ar.currency).toBe('USD')
    expect(ar.foreignDebit).toBe(1500) // 1000 + 500
    expect(ar.foreignCredit).toBe(0)
    expect(ar.functionalDebit).toBe(2025) // 1350 + 675

    const rev = tb.find((l) => l.accountCode === '4000')!
    expect(rev.foreignCredit).toBe(1500)
    expect(rev.functionalCredit).toBe(2025)
  })

  it('sorts by account code then currency', () => {
    const tb = multiCurrencyTrialBalance(entries)
    expect(tb[0]!.accountCode).toBe('1200')
    expect(tb[1]!.accountCode).toBe('4000')
  })
})
