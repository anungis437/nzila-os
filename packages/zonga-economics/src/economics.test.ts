import { describe, it, expect } from 'vitest'
import {
  validateLedgerEntries,
  validateTransaction,
  buildTransferEntries,
  computeBalanceFromEntries,
} from './ledger'
import {
  applyFees,
  DEFAULT_FEE_RULES,
} from './fees'
import {
  validateSplitRules,
  calculateSplits,
} from './splits'
import {
  EntryDirection,
  TransactionStatus,
  Currency,
  FeeType,
} from './types'
import type {
  EconomicEntry,
  EconomicTransaction,
  FeeRule,
  SplitRule,
} from './types'

// ── Helpers ─────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<EconomicEntry>): EconomicEntry {
  return {
    id: 'entry-1',
    transactionId: 'tx-1',
    accountId: 'acct-1',
    direction: EntryDirection.DEBIT,
    amount: 100,
    currency: Currency.USD,
    balanceAfter: 100,
    description: 'Test entry',
    createdAt: new Date(),
    ...overrides,
  }
}

function makeSplitRule(overrides: Partial<SplitRule>): SplitRule {
  return {
    id: 'split-1',
    orgId: 'org-1',
    revenueSource: 'stream' as any,
    recipientAccountId: 'acct-1',
    recipientName: 'Artist',
    sharePercent: 100,
    priority: 1,
    isActive: true,
    effectiveFrom: new Date('2024-01-01'),
    effectiveUntil: null,
    ...overrides,
  }
}

// ── Ledger Tests ────────────────────────────────────────────────────────

describe('@nzila/zonga-economics — ledger', () => {
  it('validates balanced entries', () => {
    const entries = [
      makeEntry({ id: 'e1', direction: EntryDirection.DEBIT, amount: 100, accountId: 'a1' }),
      makeEntry({ id: 'e2', direction: EntryDirection.CREDIT, amount: 100, accountId: 'a2' }),
    ]
    const result = validateLedgerEntries(entries)
    expect(result.valid).toBe(true)
    expect(result.totalDebits).toBe(100)
    expect(result.totalCredits).toBe(100)
  })

  it('rejects imbalanced entries', () => {
    const entries = [
      makeEntry({ id: 'e1', direction: EntryDirection.DEBIT, amount: 100, accountId: 'a1' }),
      makeEntry({ id: 'e2', direction: EntryDirection.CREDIT, amount: 50, accountId: 'a2' }),
    ]
    const result = validateLedgerEntries(entries)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('imbalance'))).toBe(true)
  })

  it('rejects empty entries', () => {
    const result = validateLedgerEntries([])
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('No entries')
  })

  it('rejects single entry (requires double-entry)', () => {
    const result = validateLedgerEntries([
      makeEntry({ id: 'e1', direction: EntryDirection.DEBIT, amount: 100 }),
    ])
    expect(result.valid).toBe(false)
  })

  it('rejects zero or negative amounts', () => {
    const entries = [
      makeEntry({ id: 'e1', direction: EntryDirection.DEBIT, amount: -10 }),
      makeEntry({ id: 'e2', direction: EntryDirection.CREDIT, amount: -10 }),
    ]
    const result = validateLedgerEntries(entries)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('positive'))).toBe(true)
  })

  it('builds balanced transfer entries', () => {
    const entries = buildTransferEntries({
      transactionId: 'tx-1',
      sourceAccountId: 'a1',
      destinationAccountId: 'a2',
      amount: 250,
      currency: Currency.KES,
      description: 'Creator payout',
      sourceBalanceAfter: 750,
      destinationBalanceAfter: 250,
    })
    expect(entries).toHaveLength(2)
    const debit = entries.find(e => e.direction === EntryDirection.DEBIT)
    const credit = entries.find(e => e.direction === EntryDirection.CREDIT)
    expect(debit?.amount).toBe(250)
    expect(credit?.amount).toBe(250)
  })

  it('computes balance from entries', () => {
    const entries = [
      makeEntry({ direction: EntryDirection.CREDIT, amount: 500 }),
      makeEntry({ direction: EntryDirection.DEBIT, amount: 200 }),
      makeEntry({ direction: EntryDirection.CREDIT, amount: 100 }),
    ]
    // Credits add, debits subtract: 500 - 200 + 100 = 400
    const balance = computeBalanceFromEntries(entries)
    expect(balance).toBe(400)
  })
})

// ── Fee Tests ───────────────────────────────────────────────────────────

describe('@nzila/zonga-economics — fees', () => {
  it('applies stream platform fee (15%)', () => {
    const result = applyFees({
      grossAmount: 100,
      currency: Currency.USD,
      revenueSource: 'stream' as any,
      rules: DEFAULT_FEE_RULES as unknown as FeeRule[],
    })
    expect(result.fees).toHaveLength(1)
    expect(result.fees[0]!.amount).toBe(15)
    expect(result.netAmount).toBe(85)
  })

  it('applies ticket sale fees (8% + $0.25 platform + 1.5% + $0.10 processing)', () => {
    const result = applyFees({
      grossAmount: 50,
      currency: Currency.USD,
      revenueSource: 'ticket_sale' as any,
      rules: DEFAULT_FEE_RULES as unknown as FeeRule[],
    })
    // Platform: 8% of 50 + $0.25 = $4.25
    // Processing: 1.5% of 50 + $0.10 = $0.85
    expect(result.fees).toHaveLength(2)
    const platformFee = result.fees.find(f => f.type === FeeType.PLATFORM_COMMISSION)
    const processingFee = result.fees.find(f => f.type === FeeType.PAYMENT_PROCESSING)
    expect(platformFee?.amount).toBeCloseTo(4.25)
    expect(processingFee?.amount).toBeCloseTo(0.85)
    expect(result.netAmount).toBeCloseTo(44.90)
  })

  it('applies tip fee (3%)', () => {
    const result = applyFees({
      grossAmount: 20,
      currency: Currency.USD,
      revenueSource: 'tip' as any,
      rules: DEFAULT_FEE_RULES as unknown as FeeRule[],
    })
    expect(result.fees[0]!.amount).toBeCloseTo(0.60)
    expect(result.netAmount).toBeCloseTo(19.40)
  })

  it('returns zero fees for unknown revenue source', () => {
    const result = applyFees({
      grossAmount: 100,
      currency: Currency.USD,
      revenueSource: 'unknown' as any,
      rules: DEFAULT_FEE_RULES as unknown as FeeRule[],
    })
    expect(result.fees).toHaveLength(0)
    expect(result.netAmount).toBe(100)
  })
})

// ── Split Tests ─────────────────────────────────────────────────────────

describe('@nzila/zonga-economics — splits', () => {
  it('validates rules summing to 100%', () => {
    const rules = [
      makeSplitRule({ recipientAccountId: 'a1', recipientName: 'Artist', sharePercent: 70 }),
      makeSplitRule({ recipientAccountId: 'a2', recipientName: 'Producer', sharePercent: 30, id: 's2' }),
    ]
    const result = validateSplitRules(rules)
    expect(result.valid).toBe(true)
    expect(result.totalPercent).toBe(100)
  })

  it('rejects rules not summing to 100%', () => {
    const rules = [
      makeSplitRule({ recipientAccountId: 'a1', sharePercent: 60 }),
      makeSplitRule({ recipientAccountId: 'a2', sharePercent: 20, id: 's2' }),
    ]
    const result = validateSplitRules(rules)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('100%'))).toBe(true)
  })

  it('rejects duplicate recipients', () => {
    const rules = [
      makeSplitRule({ recipientAccountId: 'a1', sharePercent: 50 }),
      makeSplitRule({ recipientAccountId: 'a1', sharePercent: 50, id: 's2' }),
    ]
    const result = validateSplitRules(rules)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('Duplicate'))).toBe(true)
  })

  it('rejects empty rules', () => {
    const result = validateSplitRules([])
    expect(result.valid).toBe(false)
  })

  it('calculates splits with fees applied first', () => {
    const splitRules: SplitRule[] = [
      makeSplitRule({
        recipientAccountId: 'artist-1', recipientName: 'Artist',
        sharePercent: 70, priority: 1,
      }),
      makeSplitRule({
        recipientAccountId: 'label-1', recipientName: 'Label',
        sharePercent: 30, priority: 0, id: 's2',
      }),
    ]

    const result = calculateSplits({
      revenueEventId: 'rev-1',
      grossAmount: 100,
      currency: Currency.USD,
      revenueSource: 'stream' as any,
      splitRules,
      feeRules: DEFAULT_FEE_RULES as unknown as FeeRule[],
    })

    // After 15% stream fee, net = $85
    expect(result.netAmount).toBe(85)
    // Artist gets 70% of $85 = $59.50
    const artist = result.distributions.find(d => d.recipientName === 'Artist')
    expect(artist?.amount).toBeCloseTo(59.50)
    // Label gets 30% of $85 = $25.50
    const label = result.distributions.find(d => d.recipientName === 'Label')
    expect(label?.amount).toBeCloseTo(25.50)
  })
})
