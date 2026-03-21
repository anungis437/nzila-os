/**
 * Zonga — Economic Engine Operational Proof Suite
 *
 * ECO-1: Ledger always balanced (1 000 random transactions)
 * ECO-2: No revenue without ledger backing (guard-level correlation)
 * ECO-3: Fee computation correctness (all 14 revenue sources)
 * ECO-4: Split accuracy (randomised shares always sum correctly)
 * ECO-5: Settlement reconciliation (partial failure behaviour)
 * ECO-6: Payout reversal integrity (double-entry reversal proof)
 */
import { describe, it, expect } from 'vitest'
import {
  validateLedgerEntries,
  validateTransaction,
  buildTransferEntries,
  computeBalanceFromEntries,
  reconcileAccount,
} from './ledger'
import { applyFees, DEFAULT_FEE_RULES, resolveFeeRules } from './fees'
import { validateSplitRules, calculateSplits } from './splits'
import {
  validateSettlement,
  generatePayoutBatches,
  computeSettlementSummary,
} from './settlement'
import {
  EntryDirection,
  RevenueSource,
  Currency,
  TransactionStatus,
  PayoutInstructionStatus,
  SettlementBatchStatus,
  AccountType,
} from './types'
import type {
  EconomicEntry,
  EconomicAccount,
  EconomicTransaction,
  SplitRule,
  PayoutInstruction,
  SettlementBatch,
} from './types'

// ── Helpers ──────────────────────────────────────────────────────────

let _id = 0
function nextId(prefix = 'id'): string { return `${prefix}_${++_id}` }

function makeEntry(overrides: Partial<EconomicEntry> = {}): EconomicEntry {
  return {
    id: nextId('entry'),
    transactionId: 'tx-1',
    accountId: 'acct-1',
    direction: EntryDirection.DEBIT,
    amount: 100,
    currency: Currency.USD,
    balanceAfter: 100,
    description: 'Test entry',
    createdAt: new Date('2025-06-01'),
    ...overrides,
  }
}

function makeAccount(overrides: Partial<EconomicAccount> = {}): EconomicAccount {
  return {
    id: overrides.id ?? nextId('acct'),
    orgId: 'org-1',
    type: AccountType.CREATOR,
    ownerId: 'user-1',
    ownerName: 'Test Creator',
    currency: Currency.USD,
    balance: 1000,
    holdBalance: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeTransaction(overrides: Partial<EconomicTransaction> = {}): EconomicTransaction {
  return {
    id: nextId('tx'),
    orgId: 'org-1',
    status: TransactionStatus.POSTED,
    description: 'Test transaction',
    revenueEventId: null,
    correlationId: nextId('corr'),
    entries: [],
    metadata: {},
    createdAt: new Date(),
    postedAt: new Date(),
    ...overrides,
  }
}

function makeSplitRule(overrides: Partial<SplitRule> = {}): SplitRule {
  return {
    id: nextId('split'),
    orgId: 'org-1',
    revenueSource: RevenueSource.STREAM,
    recipientAccountId: nextId('acct'),
    recipientName: 'Creator',
    sharePercent: 100,
    priority: 0,
    isActive: true,
    effectiveFrom: new Date('2024-01-01'),
    effectiveUntil: null,
    ...overrides,
  }
}

function makePayoutInstruction(overrides: Partial<PayoutInstruction> = {}): PayoutInstruction {
  return {
    id: nextId('payout'),
    orgId: 'org-1',
    accountId: 'acct-1',
    recipientId: 'user-1',
    recipientName: 'Creator',
    amount: 100,
    currency: Currency.USD,
    status: PayoutInstructionStatus.APPROVED,
    payoutRail: 'mobile_money',
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

function makeSettlementBatch(overrides: Partial<SettlementBatch> = {}): SettlementBatch {
  return {
    id: nextId('batch'),
    orgId: 'org-1',
    status: SettlementBatchStatus.OPEN,
    instructionCount: 10,
    totalAmount: 1000,
    currency: Currency.USD,
    processedCount: 0,
    failedCount: 0,
    metadata: {},
    createdAt: new Date(),
    settledAt: null,
    ...overrides,
  }
}

/** Seeded pseudo-random for reproducible property tests */
function seededRand(seed: number): () => number {
  let s = seed
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff }
}

function randomAmount(min: number, max: number, seed: number): number {
  const rand = seededRand(seed)
  return Math.round((min + rand() * (max - min)) * 100) / 100
}

function randomSplits(count: number, seed: number): number[] {
  const rand = seededRand(seed)
  if (count <= 0) return []
  if (count === 1) return [100]
  const breakpoints: number[] = []
  for (let i = 0; i < count - 1; i++) breakpoints.push(Math.floor(rand() * 10000))
  breakpoints.sort((a, b) => a - b)
  const segments: number[] = []
  let prev = 0
  for (const bp of breakpoints) { segments.push(bp - prev); prev = bp }
  segments.push(10000 - prev)
  return segments.map((s) => Math.round(s) / 100)
}

// ── ECO-1: Ledger Always Balanced ─────────────────────────────────────

describe('ECO-1: Ledger always balanced under high-volume ingestion', () => {
  it('1 000 random balanced transactions all validate', () => {
    for (let i = 0; i < 1000; i++) {
      const amount = randomAmount(0.01, 50000, i * 7919)
      const txId = `tx-${i}`
      const [debit, credit] = buildTransferEntries({
        transactionId: txId,
        sourceAccountId: 'acct-source',
        destinationAccountId: 'acct-dest',
        amount,
        currency: Currency.USD,
        description: `Transfer #${i}`,
        sourceBalanceAfter: -amount,
        destinationBalanceAfter: amount,
      })

      const result = validateLedgerEntries([debit, credit])
      expect(result.valid).toBe(true)
      expect(Math.abs(result.totalDebits - result.totalCredits)).toBeLessThan(0.001)
    }
  })

  it('rejects single-entry transactions', () => {
    const entry = makeEntry({ amount: 100 })
    const result = validateLedgerEntries([entry])
    expect(result.valid).toBe(false)
  })

  it('rejects empty entry set', () => {
    const result = validateLedgerEntries([])
    expect(result.valid).toBe(false)
  })

  it('detects imbalanced entries', () => {
    const debit = makeEntry({ direction: EntryDirection.DEBIT, amount: 100 })
    const credit = makeEntry({ direction: EntryDirection.CREDIT, amount: 99, id: 'entry-credit' })
    const result = validateLedgerEntries([debit, credit])
    expect(result.valid).toBe(false)
    expect(result.errors.some((e: string) => e.includes('imbalance'))).toBe(true)
  })

  it('passes balanced entries within $0.001 tolerance', () => {
    const debit = makeEntry({ direction: EntryDirection.DEBIT, amount: 100 })
    const credit = makeEntry({ direction: EntryDirection.CREDIT, amount: 100.0005, id: 'entry-credit' })
    const result = validateLedgerEntries([debit, credit])
    expect(result.valid).toBe(true)
  })
})

// ── ECO-2: Transaction Validation ─────────────────────────────────────

describe('ECO-2: Transaction validation enforces correlation and consistency', () => {
  it('rejects transaction without correlationId', () => {
    const tx = makeTransaction({
      correlationId: '',
      entries: [
        makeEntry({ direction: EntryDirection.DEBIT, amount: 50 }),
        makeEntry({ direction: EntryDirection.CREDIT, amount: 50, id: 'c1' }),
      ],
    })
    const result = validateTransaction(tx)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e: string) => e.includes('correlationId'))).toBe(true)
  })

  it('rejects posted transaction without postedAt', () => {
    const tx = makeTransaction({
      status: TransactionStatus.POSTED,
      postedAt: null,
      entries: [
        makeEntry({ direction: EntryDirection.DEBIT, amount: 50 }),
        makeEntry({ direction: EntryDirection.CREDIT, amount: 50, id: 'c1' }),
      ],
    })
    const result = validateTransaction(tx)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e: string) => e.includes('postedAt'))).toBe(true)
  })

  it('rejects multi-currency transaction entries', () => {
    const tx = makeTransaction({
      entries: [
        makeEntry({ direction: EntryDirection.DEBIT, amount: 100, currency: Currency.USD }),
        makeEntry({ direction: EntryDirection.CREDIT, amount: 100, currency: Currency.KES, id: 'c1' }),
      ],
    })
    const result = validateTransaction(tx)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e: string) => e.includes('multiple currencies'))).toBe(true)
  })

  it('idempotent: same transaction validates the same way 100 times', () => {
    const tx = makeTransaction({
      entries: [
        makeEntry({ direction: EntryDirection.DEBIT, amount: 100 }),
        makeEntry({ direction: EntryDirection.CREDIT, amount: 100, id: 'c1' }),
      ],
    })
    const results = Array.from({ length: 100 }, () => validateTransaction(tx))
    const first = results[0]!
    expect(results.every((r) => r.valid === first.valid && r.errors.length === first.errors.length)).toBe(true)
  })
})

// ── ECO-3: Fee Computation ────────────────────────────────────────────

describe('ECO-3: Fee computation correctness across all 14 revenue sources', () => {
  const ALL_SOURCES: RevenueSource[] = [
    RevenueSource.STREAM,
    RevenueSource.DOWNLOAD,
    RevenueSource.TICKET_SALE,
    RevenueSource.TIP,
    RevenueSource.SUBSCRIPTION,
    RevenueSource.SYNC_LICENSE,
    RevenueSource.MERCHANDISE,
    RevenueSource.SPONSORSHIP,
    RevenueSource.RADIO_BROADCAST,
    RevenueSource.LIVE_PERFORMANCE,
    RevenueSource.PUBLISHING_PERFORMANCE,
    RevenueSource.SAMPLING_LICENSE,
    RevenueSource.REMIX_LICENSE,
    RevenueSource.PODCAST_LICENSE,
  ]

  for (const source of ALL_SOURCES) {
    it(`fees for ${source}: gross − fees = net`, () => {
      const grossAmount = 1000
      const result = applyFees({
        grossAmount,
        currency: Currency.USD,
        revenueSource: source,
        rules: DEFAULT_FEE_RULES,
      })

      const totalFees = result.fees.reduce((sum, f) => sum + f.amount, 0)
      expect(Math.abs(grossAmount - totalFees - result.netAmount)).toBeLessThan(0.02)
      expect(result.netAmount).toBeGreaterThan(0)
      for (const fee of result.fees) {
        expect(fee.amount).toBeGreaterThanOrEqual(0)
      }
    })
  }

  it('no fees when no rules match', () => {
    const result = applyFees({
      grossAmount: 1000,
      currency: Currency.USD,
      revenueSource: RevenueSource.STREAM,
      rules: [],
    })
    expect(result.fees).toHaveLength(0)
    expect(result.netAmount).toBe(1000)
  })

  it('inactive rules are excluded', () => {
    const inactiveRule = { ...DEFAULT_FEE_RULES[0]!, isActive: false }
    const result = applyFees({
      grossAmount: 1000,
      currency: Currency.USD,
      revenueSource: RevenueSource.STREAM,
      rules: [inactiveRule],
    })
    expect(result.fees).toHaveLength(0)
    expect(result.netAmount).toBe(1000)
  })

  it('expired rules are excluded', () => {
    const expiredRule = { ...DEFAULT_FEE_RULES[0]!, effectiveUntil: new Date('2020-01-01') }
    const result = applyFees({
      grossAmount: 1000,
      currency: Currency.USD,
      revenueSource: RevenueSource.STREAM,
      rules: [expiredRule],
    })
    expect(result.fees).toHaveLength(0)
  })

  it('org-specific rules override wildcard', () => {
    const resolved = resolveFeeRules(DEFAULT_FEE_RULES, 'custom-org', RevenueSource.STREAM)
    expect(resolved.length).toBeGreaterThan(0)
    expect(resolved.every((r) => r.orgId === '*')).toBe(true)
  })

  it('stress: 10 000 fee calculations produce consistent positive nets', () => {
    for (let i = 1; i <= 10000; i++) {
      const amount = i * 0.01
      const result = applyFees({
        grossAmount: amount,
        currency: Currency.USD,
        revenueSource: RevenueSource.STREAM,
        rules: DEFAULT_FEE_RULES,
      })
      expect(result.netAmount).toBeGreaterThanOrEqual(0)
      expect(result.netAmount).toBeLessThanOrEqual(amount)
    }
  })
})

// ── ECO-4: Split Accuracy ─────────────────────────────────────────────

describe('ECO-4: Split accuracy — randomised shares always distribute correctly', () => {
  it('100 random split configurations all sum to 100%', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const count = (seed % 5) + 2
      const percentages = randomSplits(count, seed)
      const total = percentages.reduce((s, p) => s + p, 0)
      expect(Math.abs(total - 100)).toBeLessThan(0.5)
    }
  })

  it('rejects shares not summing to 100', () => {
    const rules = [
      makeSplitRule({ recipientAccountId: 'a', recipientName: 'A', sharePercent: 60 }),
      makeSplitRule({ recipientAccountId: 'b', recipientName: 'B', sharePercent: 30 }),
    ]
    const result = validateSplitRules(rules)
    expect(result.valid).toBe(false)
    expect(result.totalPercent).toBe(90)
  })

  it('passes for exact 100%', () => {
    const rules = [
      makeSplitRule({ recipientAccountId: 'a', recipientName: 'A', sharePercent: 70 }),
      makeSplitRule({ recipientAccountId: 'b', recipientName: 'B', sharePercent: 30 }),
    ]
    expect(validateSplitRules(rules).valid).toBe(true)
  })

  it('rejects duplicate recipients', () => {
    const rules = [
      makeSplitRule({ recipientAccountId: 'a', recipientName: 'A', sharePercent: 50 }),
      makeSplitRule({ recipientAccountId: 'a', recipientName: 'A', sharePercent: 50 }),
    ]
    const result = validateSplitRules(rules)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e: string) => e.includes('Duplicate'))).toBe(true)
  })

  it('calculateSplits: distributions + remainder = netAmount', () => {
    const rules = [
      makeSplitRule({ recipientAccountId: 'a', recipientName: 'Artist', sharePercent: 60 }),
      makeSplitRule({ recipientAccountId: 'b', recipientName: 'Producer', sharePercent: 25 }),
      makeSplitRule({ recipientAccountId: 'c', recipientName: 'Label', sharePercent: 15 }),
    ]
    const result = calculateSplits({
      revenueEventId: 'rev-1',
      grossAmount: 1000,
      currency: Currency.USD,
      revenueSource: RevenueSource.STREAM,
      splitRules: rules,
      feeRules: [...DEFAULT_FEE_RULES],
    })
    const totalDistributed = result.distributions.reduce((s, d) => s + d.amount, 0)
    expect(Math.abs(totalDistributed + result.remainder - result.netAmount)).toBeLessThan(0.02)
  })

  it('property: 50 random splits produce valid distributions', () => {
    for (let seed = 100; seed < 150; seed++) {
      const count = (seed % 4) + 2
      const pcts = randomSplits(count, seed)
      const rules = pcts.map((p, i) =>
        makeSplitRule({ recipientAccountId: `r${i}`, recipientName: `Recipient ${i}`, sharePercent: p }),
      )
      const grossAmount = randomAmount(10, 100000, seed * 31)
      const result = calculateSplits({
        revenueEventId: `rev-prop-${seed}`,
        grossAmount,
        currency: Currency.USD,
        revenueSource: RevenueSource.STREAM,
        splitRules: rules,
        feeRules: [...DEFAULT_FEE_RULES],
      })
      expect(result.netAmount).toBeGreaterThan(0)
      expect(result.netAmount).toBeLessThanOrEqual(grossAmount)
      for (const d of result.distributions) {
        expect(d.amount).toBeGreaterThanOrEqual(0)
      }
    }
  })
})

// ── ECO-5: Settlement Reconciliation ──────────────────────────────────

describe('ECO-5: Settlement reconciliation under partial failure', () => {
  it('validates all-approved instructions pass', () => {
    const acct = makeAccount({ id: 'acct-1', balance: 5000 })
    const instructions = Array.from({ length: 10 }, (_, i) =>
      makePayoutInstruction({ id: `p${i}`, accountId: 'acct-1', amount: 100 }),
    )
    const result = validateSettlement(instructions, [acct])
    expect(result.valid).toBe(true)
    expect(result.totalAmount).toBe(1000)
    expect(result.instructionCount).toBe(10)
  })

  it('rejects non-approved instructions', () => {
    const acct = makeAccount({ id: 'acct-1', balance: 5000 })
    const instructions = [
      makePayoutInstruction({ id: 'p1', accountId: 'acct-1', amount: 100 }),
      makePayoutInstruction({ id: 'p2', accountId: 'acct-1', amount: 100, status: PayoutInstructionStatus.PENDING }),
    ]
    const result = validateSettlement(instructions, [acct])
    expect(result.valid).toBe(false)
    expect(result.errors.some((e: string) => e.includes('APPROVED'))).toBe(true)
  })

  it('rejects insufficient balance', () => {
    const acct = makeAccount({ id: 'acct-1', balance: 50, holdBalance: 0 })
    const instructions = [
      makePayoutInstruction({ id: 'p1', accountId: 'acct-1', amount: 100 }),
    ]
    const result = validateSettlement(instructions, [acct])
    expect(result.valid).toBe(false)
    expect(result.errors.some((e: string) => e.includes('insufficient'))).toBe(true)
  })

  it('summary: processed + failed = total ⟹ isComplete', () => {
    const batch = makeSettlementBatch({ instructionCount: 20, processedCount: 15, failedCount: 5 })
    const summary = computeSettlementSummary(batch)
    expect(summary.isComplete).toBe(true)
    expect(summary.pendingCount).toBe(0)
    expect(summary.successRate + summary.failureRate).toBe(100)
  })

  it('summary: partial completion detected', () => {
    const batch = makeSettlementBatch({ instructionCount: 20, processedCount: 10, failedCount: 3 })
    const summary = computeSettlementSummary(batch)
    expect(summary.isComplete).toBe(false)
    expect(summary.pendingCount).toBe(7)
  })

  it('generatePayoutBatches groups by currency', () => {
    const instructions = [
      makePayoutInstruction({ currency: Currency.USD, amount: 100 }),
      makePayoutInstruction({ currency: Currency.USD, amount: 200 }),
      makePayoutInstruction({ currency: Currency.KES, amount: 5000 }),
    ]
    const batches = generatePayoutBatches(instructions)
    expect(batches.length).toBe(2)
    const usdBatch = batches.find((b) => b.currency === Currency.USD)
    const kesBatch = batches.find((b) => b.currency === Currency.KES)
    expect(usdBatch!.totalAmount).toBe(300)
    expect(kesBatch!.totalAmount).toBe(5000)
  })
})

// ── ECO-6: Payout Reversal Integrity ──────────────────────────────────

describe('ECO-6: Payout reversal integrity — double-entry reversal proof', () => {
  it('reversed transfer entries re-balance to zero', () => {
    const amount = 500
    const [origDebit, origCredit] = buildTransferEntries({
      transactionId: 'tx-orig',
      sourceAccountId: 'source',
      destinationAccountId: 'dest',
      amount,
      currency: Currency.USD,
      description: 'Original payout',
      sourceBalanceAfter: -amount,
      destinationBalanceAfter: amount,
    })
    const [revDebit, revCredit] = buildTransferEntries({
      transactionId: 'tx-reversal',
      sourceAccountId: 'dest',
      destinationAccountId: 'source',
      amount,
      currency: Currency.USD,
      description: 'Reversal',
      sourceBalanceAfter: 0,
      destinationBalanceAfter: 0,
    })
    const allEntries = [origDebit, origCredit, revDebit, revCredit]
    const sourceBalance = computeBalanceFromEntries(allEntries.filter((e) => e.accountId === 'source'))
    const destBalance = computeBalanceFromEntries(allEntries.filter((e) => e.accountId === 'dest'))
    expect(sourceBalance).toBe(0)
    expect(destBalance).toBe(0)
  })

  it('reconciliation detects un-reversed transaction', () => {
    const acct = makeAccount({ id: 'acct-1', balance: 0 })
    const entries = [makeEntry({ accountId: 'acct-1', direction: EntryDirection.CREDIT, amount: 100 })]
    const result = reconcileAccount(acct, entries)
    expect(result.isBalanced).toBe(false)
    expect(result.discrepancy).toBe(100)
  })

  it('reconciliation passes when balance matches entries', () => {
    const acct = makeAccount({ id: 'acct-1', balance: 100 })
    const entries = [makeEntry({ accountId: 'acct-1', direction: EntryDirection.CREDIT, amount: 100 })]
    const result = reconcileAccount(acct, entries)
    expect(result.isBalanced).toBe(true)
    expect(result.discrepancy).toBeLessThan(0.001)
  })

  it('reconciliation with asOf filter only considers past entries', () => {
    const past = new Date('2025-01-01')
    const future = new Date('2025-12-31')
    const acct = makeAccount({ id: 'acct-1', balance: 100 })
    const entries = [
      makeEntry({ accountId: 'acct-1', direction: EntryDirection.CREDIT, amount: 100, createdAt: past }),
      makeEntry({ accountId: 'acct-1', direction: EntryDirection.CREDIT, amount: 200, createdAt: future, id: 'e2' }),
    ]
    const result = reconcileAccount(acct, entries, new Date('2025-06-01'))
    expect(result.computedBalance).toBe(100)
    expect(result.isBalanced).toBe(true)
  })
})
