import { describe, it, expect } from 'vitest'
import {
  validateLedgerEntries,
  buildTransferEntries,
  computeBalanceFromEntries,
  snapshotBalance,
} from './ledger'
import {
  applyFees,
  DEFAULT_FEE_RULES,
  resolveFeeRules,
} from './fees'
import {
  validateSplitRules,
  calculateSplits,
} from './splits'
import {
  validateSettlement,
  computeSettlementSummary,
  generatePayoutBatches,
} from './settlement'
import {
  EntryDirection,
  RevenueSource,
  Currency,
  FeeType,
  AccountType,
  PayoutInstructionStatus,
} from './types'
import type {
  EconomicEntry,
  EconomicAccount,
  FeeRule,
  PayoutInstruction,
  SettlementBatch,
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
    revenueSource: RevenueSource.STREAM,
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
      revenueSource: RevenueSource.STREAM,
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
      revenueSource: RevenueSource.TICKET_SALE,
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

  it('applies tip fee (10%)', () => {
    const result = applyFees({
      grossAmount: 20,
      currency: Currency.USD,
      revenueSource: RevenueSource.TIP,
      rules: DEFAULT_FEE_RULES as unknown as FeeRule[],
    })
    expect(result.fees[0]!.amount).toBeCloseTo(2.00)
    expect(result.netAmount).toBeCloseTo(18.00)
  })

  it('returns zero fees for unknown revenue source', () => {
    const result = applyFees({
      grossAmount: 100,
      currency: Currency.USD,
      revenueSource: 'unknown' as RevenueSource,
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
      revenueSource: RevenueSource.STREAM,
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

  it('rejects negative share percent', () => {
    const rules = [
      makeSplitRule({ recipientAccountId: 'a1', recipientName: 'Artist', sharePercent: -10 }),
      makeSplitRule({ recipientAccountId: 'a2', recipientName: 'Label', sharePercent: 110, id: 's2' }),
    ]
    const result = validateSplitRules(rules)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('Negative share'))).toBe(true)
  })

  it('rejects zero share percent', () => {
    const rules = [
      makeSplitRule({ recipientAccountId: 'a1', recipientName: 'Artist', sharePercent: 0 }),
      makeSplitRule({ recipientAccountId: 'a2', recipientName: 'Label', sharePercent: 100, id: 's2' }),
    ]
    const result = validateSplitRules(rules)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('Zero share'))).toBe(true)
  })
})

// ── Fee Edge-Case Tests ─────────────────────────────────────────────────

describe('@nzila/zonga-economics — fees (edge cases)', () => {
  it('enforces minAmount floor on computed fee', () => {
    const rule: FeeRule = {
      id: 'fee_min_test',
      orgId: '*',
      feeType: FeeType.PLATFORM_COMMISSION,
      revenueSource: RevenueSource.STREAM,
      ratePercent: 1,
      flatAmount: 0,
      currency: Currency.USD,
      minAmount: 5,
      maxAmount: null,
      isActive: true,
      effectiveFrom: new Date('2024-01-01'),
      effectiveUntil: null,
    }
    // 1% of $10 = $0.10, which is below minAmount of $5
    const result = applyFees({
      grossAmount: 10,
      currency: Currency.USD,
      revenueSource: RevenueSource.STREAM,
      rules: [rule],
    })
    expect(result.fees[0]!.amount).toBe(5)
    expect(result.netAmount).toBe(5)
  })

  it('enforces maxAmount cap on computed fee', () => {
    const rule: FeeRule = {
      id: 'fee_max_test',
      orgId: '*',
      feeType: FeeType.PLATFORM_COMMISSION,
      revenueSource: RevenueSource.STREAM,
      ratePercent: 50,
      flatAmount: 0,
      currency: Currency.USD,
      minAmount: 0,
      maxAmount: 2,
      isActive: true,
      effectiveFrom: new Date('2024-01-01'),
      effectiveUntil: null,
    }
    // 50% of $100 = $50, which exceeds maxAmount of $2
    const result = applyFees({
      grossAmount: 100,
      currency: Currency.USD,
      revenueSource: RevenueSource.STREAM,
      rules: [rule],
    })
    expect(result.fees[0]!.amount).toBe(2)
    expect(result.netAmount).toBe(98)
  })
})

describe('@nzila/zonga-economics — fee rule resolution', () => {
  it('returns org-specific rules when they exist', () => {
    const orgRule: FeeRule = {
      id: 'org_fee',
      orgId: 'org-42',
      feeType: FeeType.PLATFORM_COMMISSION,
      revenueSource: RevenueSource.STREAM,
      ratePercent: 5,
      flatAmount: 0,
      currency: Currency.USD,
      minAmount: 0,
      maxAmount: null,
      isActive: true,
      effectiveFrom: new Date('2024-01-01'),
      effectiveUntil: null,
    }
    const wildcardRule: FeeRule = {
      id: 'wildcard_fee',
      orgId: '*',
      feeType: FeeType.PLATFORM_COMMISSION,
      revenueSource: RevenueSource.STREAM,
      ratePercent: 15,
      flatAmount: 0,
      currency: Currency.USD,
      minAmount: 0,
      maxAmount: null,
      isActive: true,
      effectiveFrom: new Date('2024-01-01'),
      effectiveUntil: null,
    }
    const rules = resolveFeeRules([orgRule, wildcardRule], 'org-42', RevenueSource.STREAM)
    expect(rules).toHaveLength(1)
    expect(rules[0]!.orgId).toBe('org-42')
    expect(rules[0]!.ratePercent).toBe(5)
  })

  it('falls back to wildcard rules when no org-specific rules', () => {
    const wildcardRule: FeeRule = {
      id: 'wildcard_fee',
      orgId: '*',
      feeType: FeeType.PLATFORM_COMMISSION,
      revenueSource: RevenueSource.STREAM,
      ratePercent: 15,
      flatAmount: 0,
      currency: Currency.USD,
      minAmount: 0,
      maxAmount: null,
      isActive: true,
      effectiveFrom: new Date('2024-01-01'),
      effectiveUntil: null,
    }
    const rules = resolveFeeRules([wildcardRule], 'org-99', RevenueSource.STREAM)
    expect(rules).toHaveLength(1)
    expect(rules[0]!.orgId).toBe('*')
  })

  it('includes rules with a future effectiveUntil date', () => {
    const rule: FeeRule = {
      id: 'expiring_fee',
      orgId: '*',
      feeType: FeeType.PLATFORM_COMMISSION,
      revenueSource: RevenueSource.STREAM,
      ratePercent: 10,
      flatAmount: 0,
      currency: Currency.USD,
      minAmount: 0,
      maxAmount: null,
      isActive: true,
      effectiveFrom: new Date('2024-01-01'),
      effectiveUntil: new Date('2030-01-01'),
    }
    const now = new Date('2025-06-01')
    const rules = resolveFeeRules([rule], 'org-1', RevenueSource.STREAM, now)
    expect(rules).toHaveLength(1)
  })

  it('excludes rules whose effectiveUntil has passed', () => {
    const rule: FeeRule = {
      id: 'expired_fee',
      orgId: '*',
      feeType: FeeType.PLATFORM_COMMISSION,
      revenueSource: RevenueSource.STREAM,
      ratePercent: 10,
      flatAmount: 0,
      currency: Currency.USD,
      minAmount: 0,
      maxAmount: null,
      isActive: true,
      effectiveFrom: new Date('2024-01-01'),
      effectiveUntil: new Date('2024-06-01'),
    }
    const now = new Date('2025-01-01')
    const rules = resolveFeeRules([rule], 'org-1', RevenueSource.STREAM, now)
    expect(rules).toHaveLength(0)
  })
})

// ── Ledger Snapshot Tests ───────────────────────────────────────────────

describe('@nzila/zonga-economics — ledger snapshot', () => {
  it('takes a balance snapshot for an account', () => {
    const account: EconomicAccount = {
      id: 'acct-1',
      orgId: 'org-1',
      type: AccountType.CREATOR,
      ownerId: 'user-1',
      ownerName: 'Artist',
      currency: Currency.USD,
      balance: 500,
      holdBalance: 50,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const snap = snapshotBalance(account)
    expect(snap.accountId).toBe('acct-1')
    expect(snap.balance).toBe(500)
    expect(snap.holdBalance).toBe(50)
    expect(snap.availableBalance).toBe(450)
    expect(snap.currency).toBe(Currency.USD)
    expect(snap.asOf).toBeInstanceOf(Date)
  })
})

// ── Settlement Tests ────────────────────────────────────────────────────

function makeAccount(overrides: Partial<EconomicAccount> = {}): EconomicAccount {
  return {
    id: 'acct-1',
    orgId: 'org-1',
    type: AccountType.CREATOR,
    ownerId: 'user-1',
    ownerName: 'Artist',
    currency: Currency.USD,
    balance: 1000,
    holdBalance: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeInstruction(overrides: Partial<PayoutInstruction> = {}): PayoutInstruction {
  return {
    id: 'instr-1',
    orgId: 'org-1',
    accountId: 'acct-1',
    recipientId: 'recip-1',
    recipientName: 'Artist',
    amount: 100,
    currency: Currency.USD,
    status: PayoutInstructionStatus.APPROVED,
    payoutRail: 'bank_transfer',
    externalRef: null,
    settlementBatchId: null,
    metadata: {},
    createdAt: new Date(),
    approvedAt: new Date(),
    completedAt: null,
    failedReason: null,
    ...overrides,
  }
}

describe('@nzila/zonga-economics — settlement', () => {
  it('rejects empty payout instructions', () => {
    const result = validateSettlement([], [])
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('No payout instructions')
    expect(result.totalAmount).toBe(0)
  })

  it('rejects multi-currency batch', () => {
    const instructions = [
      makeInstruction({ id: 'i1', currency: Currency.USD }),
      makeInstruction({ id: 'i2', currency: Currency.KES }),
    ]
    const accounts = [makeAccount()]
    const result = validateSettlement(instructions, accounts)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('single-currency'))).toBe(true)
  })

  it('rejects non-APPROVED instructions', () => {
    const instructions = [
      makeInstruction({ status: PayoutInstructionStatus.PENDING }),
    ]
    const accounts = [makeAccount()]
    const result = validateSettlement(instructions, accounts)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('APPROVED'))).toBe(true)
  })

  it('rejects zero or negative amount', () => {
    const instructions = [
      makeInstruction({ amount: 0 }),
    ]
    const accounts = [makeAccount()]
    const result = validateSettlement(instructions, accounts)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('positive'))).toBe(true)
  })

  it('rejects instruction with missing account', () => {
    const instructions = [
      makeInstruction({ accountId: 'nonexistent' }),
    ]
    const result = validateSettlement(instructions, [])
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('not found'))).toBe(true)
  })

  it('rejects instruction exceeding available balance', () => {
    const instructions = [
      makeInstruction({ amount: 800 }),
    ]
    const accounts = [makeAccount({ balance: 500, holdBalance: 100 })]
    const result = validateSettlement(instructions, accounts)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('insufficient'))).toBe(true)
  })

  it('validates a correct single instruction', () => {
    const instructions = [makeInstruction({ amount: 100 })]
    const accounts = [makeAccount({ balance: 1000, holdBalance: 0 })]
    const result = validateSettlement(instructions, accounts)
    expect(result.valid).toBe(true)
    expect(result.totalAmount).toBe(100)
    expect(result.instructionCount).toBe(1)
  })
})

describe('@nzila/zonga-economics — payout batches', () => {
  it('generates batches grouped by currency, skipping non-APPROVED', () => {
    const instructions = [
      makeInstruction({ id: 'i1', amount: 100, currency: Currency.USD }),
      makeInstruction({ id: 'i2', amount: 200, currency: Currency.USD }),
      makeInstruction({ id: 'i3', amount: 50, currency: Currency.USD, status: PayoutInstructionStatus.PENDING }),
    ]
    const batches = generatePayoutBatches(instructions)
    expect(batches).toHaveLength(1)
    expect(batches[0]!.totalAmount).toBe(300)
    expect(batches[0]!.instructions).toHaveLength(2)
  })
})

describe('@nzila/zonga-economics — settlement summary', () => {
  it('returns zero rates and complete for zero-instruction batch', () => {
    const batch: SettlementBatch = {
      id: 'batch-1',
      orgId: 'org-1',
      status: 'open',
      instructionCount: 0,
      totalAmount: 0,
      currency: Currency.USD,
      processedCount: 0,
      failedCount: 0,
      metadata: {},
      createdAt: new Date(),
      settledAt: null,
    }
    const summary = computeSettlementSummary(batch)
    expect(summary.successRate).toBe(0)
    expect(summary.failureRate).toBe(0)
    expect(summary.isComplete).toBe(true)
    expect(summary.pendingCount).toBe(0)
  })

  it('computes rates for a partially processed batch', () => {
    const batch: SettlementBatch = {
      id: 'batch-2',
      orgId: 'org-1',
      status: 'open',
      instructionCount: 10,
      totalAmount: 5000,
      currency: Currency.USD,
      processedCount: 7,
      failedCount: 1,
      metadata: {},
      createdAt: new Date(),
      settledAt: null,
    }
    const summary = computeSettlementSummary(batch)
    expect(summary.successRate).toBe(70)
    expect(summary.failureRate).toBe(10)
    expect(summary.isComplete).toBe(false)
    expect(summary.pendingCount).toBe(2)
  })
})
